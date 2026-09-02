import type { Prisma, UserRole } from "@prisma/client";
import { UserRole as Role } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { userDto } from "../../utils/serializers.js";

const sortFields = new Set(["name", "email", "createdAt", "updatedAt"]);

export async function list(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { name: { contains: String(query.search), mode: "insensitive" } },
            { email: { contains: String(query.search), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.role ? { roles: { has: query.role as UserRole } } : {}),
    ...(query.isActive !== undefined ? { isActive: Boolean(query.isActive) } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sortBy]: query.order ?? "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: rows.map(userDto), meta: meta(page, limit, total) };
}

export async function get(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { studentProfile: { include: { department: true, programme: true } } },
  });
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
  return user;
}

export async function update(
  id: string,
  data: { name?: string; avatarUrl?: string | null; isActive?: boolean },
  actorId: string,
) {
  await get(id);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        ...data,
        ...(data.isActive === false ? { tokenVersion: { increment: 1 } } : {}),
      },
    });
    if (data.isActive === false) {
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.updated",
        entityType: "User",
        entityId: id,
        metadata: { isActive: data.isActive, nameChanged: data.name !== undefined },
      },
    });
    return userDto(user);
  });
}

export async function updateRoles(id: string, roles: UserRole[], actorId: string) {
  await get(id);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { roles, tokenVersion: { increment: 1 } },
    });
    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.roles_changed",
        entityType: "User",
        entityId: id,
        metadata: { roles },
      },
    });
    return userDto(user);
  });
}

/**
 * Detaches the Google identity from an account.
 *
 * Sign-in refuses when an email already carries a *different* Google subject —
 * that guard is what stops a recycled or spoofed address from taking over an
 * existing account, so it must stay. But it leaves no way back: if the identity
 * on file is wrong (an account provisioned by an import, a Workspace user
 * deleted and recreated, a seeded row), the person is locked out permanently
 * and only direct database access can fix it.
 *
 * This is that way back. The next successful Google sign-in re-binds the
 * account to whichever identity actually authenticates, so it is deliberately
 * restricted to `user.roles.manage` — the same privilege as granting a role —
 * and every use is audited.
 */
export async function unlinkGoogleIdentity(id: string, actorId: string) {
  const existing = await get(id);
  if (!existing.googleSubject) {
    throw new ApiError(
      409,
      "IDENTITY_ALREADY_UNLINKED",
      "This account has no Google identity linked",
    );
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { googleSubject: null, tokenVersion: { increment: 1 } },
    });
    // Anything signed in under the old identity must stop being trusted now.
    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.google_identity_unlinked",
        entityType: "User",
        entityId: id,
        metadata: { previousGoogleSubject: existing.googleSubject },
      },
    });
    return userDto(user);
  });
}

/**
 * Removes an account.
 *
 * The row is retired rather than dropped: bookings, attendance and audit
 * entries all reference it, and destroying those would rewrite history that
 * exists precisely so it cannot be rewritten.
 *
 * But retiring alone is not enough. `email` and `google_subject` are unique,
 * and sign-in only ever looks at rows where `deleted_at IS NULL` — so a
 * retired row would silently hold its address hostage: the person could never
 * return, and the address could never be reissued, because the next sign-in
 * would try to insert a duplicate. Both identifiers are therefore released to
 * a tombstone form, and the originals are preserved in the audit record.
 */
export async function remove(id: string, actorId: string) {
  const existing = await get(id);
  const retiredAt = new Date();
  const tombstone = `deleted+${id}@removed.invalid`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        deletedAt: retiredAt,
        isActive: false,
        tokenVersion: { increment: 1 },
        email: tombstone,
        googleSubject: null,
      },
    });
    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: retiredAt },
    });
    // The student profile goes too. `prn` is unique, so a retired profile would
    // hold that PRN hostage exactly as the email would — the same person could
    // never re-onboard, and the registry could never reissue it. Nothing is
    // lost: bookings and attendance carry their own PRN and name snapshots, so
    // history stays readable while the personal record is cleared.
    await tx.studentProfile.deleteMany({ where: { userId: id } });
    // Any standing grant for that address goes with it, so the role is not
    // silently re-applied if somebody else is later given the same address.
    await tx.userProvisioning.deleteMany({ where: { email: existing.email } });
    // Unanswered invitations addressed to them are withdrawn.
    await tx.projectMember.updateMany({
      where: { email: existing.email, status: "PENDING" },
      data: { status: "CANCELLED", removedAt: retiredAt },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.removed",
        entityType: "User",
        entityId: id,
        metadata: {
          email: existing.email,
          name: existing.name,
          roles: existing.roles,
          addressReleased: true,
        },
      },
    });
  });
}

export async function listProvisioning(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const where: Prisma.UserProvisioningWhereInput = query.search
    ? { email: { contains: String(query.search), mode: "insensitive" } }
    : {};
  const [total, rows] = await prisma.$transaction([
    prisma.userProvisioning.count({ where }),
    prisma.userProvisioning.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: rows, meta: meta(page, limit, total) };
}

export async function createProvisioning(
  data: { email: string; name?: string | undefined; roles: UserRole[]; isActive: boolean },
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const provision = await tx.userProvisioning.upsert({
      where: { email: data.email },
      update: {
        roles: data.roles,
        isActive: data.isActive,
        // Re-provisioning without a name must not erase the one on record.
        ...(data.name === undefined ? {} : { name: data.name }),
      },
      create: {
        email: data.email,
        name: data.name ?? null,
        roles: data.roles,
        isActive: data.isActive,
        createdById: actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.provisioned",
        entityType: "UserProvisioning",
        entityId: provision.id,
        metadata: { email: data.email, roles: data.roles, isActive: data.isActive },
      },
    });
    return provision;
  });
}

export async function updateProvisioning(
  id: string,
  data: { name?: string | null | undefined; roles?: UserRole[]; isActive?: boolean },
  actorId: string,
) {
  const existing = await prisma.userProvisioning.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Provisioning record not found");
  return prisma.$transaction(async (tx) => {
    const provision = await tx.userProvisioning.update({ where: { id }, data });
    if (provision.claimedById) {
      await tx.user.update({
        where: { id: provision.claimedById },
        data: {
          ...(data.roles ? { roles: data.roles } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          tokenVersion: { increment: 1 },
        },
      });
      await tx.session.updateMany({
        where: { userId: provision.claimedById, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.provisioning_updated",
        entityType: "UserProvisioning",
        entityId: id,
        metadata: data,
      },
    });
    return provision;
  });
}

export async function searchFacultyMentors(query: Record<string, unknown>, viewerId: string) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 50), 100);
  // Browsable directory: an absent or blank term lists every mentor
  // alphabetically rather than returning nothing. `contains: ""` matches every
  // row, so the empty case needs no separate query.
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const where: Prisma.UserWhereInput = {
    id: { not: viewerId },
    isActive: true,
    deletedAt: null,
    roles: { has: Role.FACULTY_MENTOR },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        facultyProfile: { select: { prefix: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    // `prefix` is the honorific from the faculty import ("Dr.", "Prof."). The
    // division is deliberately absent: it is internal grouping, and department
    // is not known for faculty, so name and address are all a student can be
    // shown to tell two mentors apart.
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      prefix: row.facultyProfile?.prefix ?? null,
      department: null,
    })),
    meta: meta(page, limit, total),
  };
}

export async function searchStudents(query: Record<string, unknown>, viewerId: string) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 10), 20);
  const search = String(query.search).trim();
  const where: Prisma.UserWhereInput = {
    id: { not: viewerId },
    isActive: true,
    deletedAt: null,
    profileComplete: true,
    roles: { has: Role.STUDENT },
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { studentProfile: { prn: { contains: search, mode: "insensitive" } } },
    ],
  };
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: {
          select: {
            prn: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      prn: row.studentProfile!.prn,
      department: row.studentProfile!.department,
    })),
    meta: meta(page, limit, total),
  };
}

export async function updateOwnStudentProfile(
  userId: string,
  data: {
    fullName: string;
    prn: string;
    departmentId: string;
    programmeId: string;
    academicYear: number;
    division?: string | null;
    phone?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null, roles: { has: Role.STUDENT } },
    });
    if (!user) throw new ApiError(404, "NOT_FOUND", "Student account not found");

    const [programme, academicYear] = await Promise.all([
      tx.programme.findFirst({
        where: {
          id: data.programmeId,
          departmentId: data.departmentId,
          isActive: true,
          department: { isActive: true },
        },
      }),
      tx.academicYearOption.findFirst({
        where: { value: data.academicYear, isActive: true },
      }),
    ]);
    if (!programme) {
      throw new ApiError(
        400,
        "INVALID_ACADEMIC_SELECTION",
        "Programme does not belong to the selected active department",
      );
    }
    if (!academicYear) {
      throw new ApiError(400, "INVALID_ACADEMIC_YEAR", "Academic year is not active");
    }

    await tx.studentProfile.upsert({
      where: { userId },
      update: {
        prn: data.prn,
        departmentId: data.departmentId,
        programmeId: data.programmeId,
        academicYear: data.academicYear,
        division: data.division ?? null,
        phone: data.phone ?? null,
      },
      create: {
        userId,
        prn: data.prn,
        departmentId: data.departmentId,
        programmeId: data.programmeId,
        academicYear: data.academicYear,
        division: data.division ?? null,
        phone: data.phone ?? null,
      },
    });
    const updated = await tx.user.update({
      where: { id: userId },
      data: { name: data.fullName, profileComplete: true },
      include: { studentProfile: { include: { department: true, programme: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        action: "profile.student_updated",
        entityType: "StudentProfile",
        entityId: userId,
      },
    });
    return userDto(updated);
  });
}
