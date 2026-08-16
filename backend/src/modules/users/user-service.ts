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

export async function remove(id: string, actorId: string) {
  await get(id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, tokenVersion: { increment: 1 } },
    });
    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "user.deactivated",
        entityType: "User",
        entityId: id,
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
  data: { email: string; roles: UserRole[]; isActive: boolean },
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const provision = await tx.userProvisioning.upsert({
      where: { email: data.email },
      update: { roles: data.roles, isActive: data.isActive },
      create: { ...data, createdById: actorId },
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
  data: { roles?: UserRole[]; isActive?: boolean },
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
  const limit = Math.min(Number(query.limit ?? 10), 20);
  const search = String(query.search).trim();
  const where: Prisma.UserWhereInput = {
    id: { not: viewerId },
    isActive: true,
    deletedAt: null,
    roles: { has: Role.FACULTY_MENTOR },
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
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
          select: { department: { select: { id: true, code: true, name: true } } },
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
      department: row.studentProfile?.department ?? null,
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
