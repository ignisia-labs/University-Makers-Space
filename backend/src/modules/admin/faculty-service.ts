import crypto from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { invalidate } from "../../utils/cache.js";
import type { RequestContext, Viewer } from "../visits/visit-shared.js";

/**
 * Divisions and faculty.
 *
 * A Division is an internal grouping above departments — staff belong to one,
 * and it is never surfaced to students. It exists because faculty have no
 * department in this system yet, and inventing one for them would put a fake
 * academic unit in front of students choosing a mentor.
 *
 * Faculty are stored as real `User` rows rather than provisioning grants,
 * because a student picking a mentor searches users. Imported staff therefore
 * exist before they have ever signed in — deliberately with no Google identity
 * attached, so their first genuine sign-in adopts the account rather than
 * colliding with it.
 */

type FacultyInput = {
  prefix?: string | null;
  name: string;
  email: string;
  divisionId?: string | null;
};

async function record(
  tx: Prisma.TransactionClient,
  viewer: Viewer,
  context: RequestContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: viewer.id,
      action,
      entityType,
      entityId,
      metadata,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

// ─── divisions ───────────────────────────────────────────────────────────────

export function listDivisions() {
  return prisma.division.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { departments: true, faculty: true } } },
  });
}

export async function createDivision(
  input: { name: string },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.division.create({ data: { name: input.name } });
    await record(tx, viewer, context, "reference.division_created", "Division", row.id, input);
    return row;
  });
  await invalidate("reference:*");
  return created;
}

export async function updateDivision(
  id: string,
  input: { name?: string; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.division.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Division not found");
    const row = await tx.division.update({ where: { id }, data: input });
    await record(tx, viewer, context, "reference.division_updated", "Division", id, {
      from: { name: before.name, isActive: before.isActive },
      to: input,
    });
    return row;
  });
  await invalidate("reference:*");
  return updated;
}

/**
 * Removing a division never removes what belongs to it. Departments and faculty
 * are detached (their `division_id` is nulled by the FK), so the grouping can be
 * reorganised without touching academic records or staff accounts.
 */
export async function deleteDivision(id: string, viewer: Viewer, context: RequestContext = {}) {
  const result = await prisma.$transaction(async (tx) => {
    const division = await tx.division.findUnique({
      where: { id },
      include: { _count: { select: { departments: true, faculty: true } } },
    });
    if (!division) throw new ApiError(404, "NOT_FOUND", "Division not found");
    await tx.division.delete({ where: { id } });
    await record(tx, viewer, context, "reference.division_deleted", "Division", id, {
      name: division.name,
      detachedDepartments: division._count.departments,
      detachedFaculty: division._count.faculty,
    });
    return {
      detachedDepartments: division._count.departments,
      detachedFaculty: division._count.faculty,
    };
  });
  await invalidate("reference:*");
  return result;
}

// ─── faculty ─────────────────────────────────────────────────────────────────

const facultySelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  googleSubject: true,
  createdAt: true,
  facultyProfile: {
    select: {
      prefix: true,
      divisionId: true,
      division: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type FacultyRow = Prisma.UserGetPayload<{ select: typeof facultySelect }>;

function facultyDto(row: FacultyRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    prefix: row.facultyProfile?.prefix ?? null,
    division: row.facultyProfile?.division ?? null,
    isActive: row.isActive,
    /** False until they have signed in with Google for the first time. */
    hasSignedIn: row.googleSubject !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listFaculty(query: Record<string, unknown>) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const rows = await prisma.user.findMany({
    where: {
      roles: { has: UserRole.FACULTY_MENTOR },
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.divisionId ? { facultyProfile: { divisionId: String(query.divisionId) } } : {}),
    },
    select: facultySelect,
    orderBy: [{ name: "asc" }],
    take: 500,
  });
  return rows.map(facultyDto);
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertInstitutional(email: string) {
  if (!email.endsWith(`@${env.GOOGLE_HOSTED_DOMAIN}`)) {
    throw new ApiError(
      400,
      "NON_INSTITUTIONAL_EMAIL",
      `${email} is not an @${env.GOOGLE_HOSTED_DOMAIN} address`,
    );
  }
}

/**
 * Adds one faculty member, or promotes an existing account to faculty.
 *
 * Reusing an existing row matters: the address may already belong to somebody
 * who signed in as a student. Creating a second row would collide on the unique
 * email, and silently skipping them would leave them unable to mentor.
 */
export async function upsertFaculty(
  input: FacultyInput,
  viewer: Viewer,
  context: RequestContext = {},
) {
  const email = normaliseEmail(input.email);
  assertInstitutional(email);

  return prisma.$transaction(async (tx) => {
    if (input.divisionId) {
      const division = await tx.division.findUnique({ where: { id: input.divisionId } });
      if (!division) throw new ApiError(400, "UNKNOWN_DIVISION", "That division does not exist");
    }

    const existing = await tx.user.findUnique({ where: { email } });
    if (existing?.deletedAt) {
      throw new ApiError(
        409,
        "ACCOUNT_REMOVED",
        "That address belongs to a removed account and cannot be reused here",
      );
    }

    const roles = existing
      ? [...new Set([...existing.roles, UserRole.FACULTY_MENTOR])]
      : [UserRole.FACULTY_MENTOR];

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: input.name.trim(),
            roles,
            isActive: true,
            // Faculty have nothing to onboard, so their profile is complete
            // the moment the account exists.
            profileComplete: true,
          },
          select: facultySelect,
        })
      : await tx.user.create({
          data: {
            email,
            name: input.name.trim(),
            roles,
            profileComplete: true,
            // No googleSubject: the first genuine Google sign-in adopts this
            // account. Inventing one would lock the real person out.
          },
          select: facultySelect,
        });

    await tx.facultyProfile.upsert({
      where: { userId: user.id },
      update: { prefix: input.prefix ?? null, divisionId: input.divisionId ?? null },
      create: {
        userId: user.id,
        prefix: input.prefix ?? null,
        divisionId: input.divisionId ?? null,
      },
    });

    await record(
      tx,
      viewer,
      context,
      existing ? "faculty.updated" : "faculty.added",
      "User",
      user.id,
      {
        email,
        name: input.name,
        prefix: input.prefix ?? null,
        divisionId: input.divisionId ?? null,
      },
    );

    const refreshed = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: facultySelect,
    });
    return facultyDto(refreshed);
  });
}

export async function updateFaculty(
  id: string,
  input: { prefix?: string | null; name?: string; divisionId?: string | null; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { id, deletedAt: null, roles: { has: UserRole.FACULTY_MENTOR } },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Faculty member not found");
    if (input.divisionId) {
      const division = await tx.division.findUnique({ where: { id: input.divisionId } });
      if (!division) throw new ApiError(400, "UNKNOWN_DIVISION", "That division does not exist");
    }

    if (input.name !== undefined || input.isActive !== undefined) {
      await tx.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isActive === false ? { tokenVersion: { increment: 1 } } : {}),
        },
      });
      if (input.isActive === false) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    if (input.prefix !== undefined || input.divisionId !== undefined) {
      await tx.facultyProfile.upsert({
        where: { userId: id },
        update: {
          ...(input.prefix !== undefined ? { prefix: input.prefix } : {}),
          ...(input.divisionId !== undefined ? { divisionId: input.divisionId } : {}),
        },
        create: {
          userId: id,
          prefix: input.prefix ?? null,
          divisionId: input.divisionId ?? null,
        },
      });
    }

    await record(tx, viewer, context, "faculty.updated", "User", id, { ...input });
    const refreshed = await tx.user.findUniqueOrThrow({ where: { id }, select: facultySelect });
    return facultyDto(refreshed);
  });
}

/**
 * Removes somebody's faculty standing.
 *
 * If the account exists only because it was imported — never signed in, no
 * other role — the row goes entirely, freeing the address. Otherwise the
 * FACULTY_MENTOR role is withdrawn and the account itself is left alone: a
 * person who is also a student must not lose their account because they stopped
 * mentoring.
 */
export async function removeFaculty(id: string, viewer: Viewer, context: RequestContext = {}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { id, deletedAt: null, roles: { has: UserRole.FACULTY_MENTOR } },
      include: { _count: { select: { projectsMentored: true, mentorRequests: true } } },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Faculty member not found");

    const otherRoles = existing.roles.filter((role) => role !== UserRole.FACULTY_MENTOR);
    const untouched =
      existing.googleSubject === null &&
      otherRoles.length === 0 &&
      existing._count.projectsMentored === 0 &&
      existing._count.mentorRequests === 0;

    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (untouched) {
      await tx.facultyProfile.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    } else {
      await tx.user.update({
        where: { id },
        data: {
          roles: otherRoles.length ? otherRoles : [UserRole.STUDENT],
          tokenVersion: { increment: 1 },
        },
      });
      await tx.facultyProfile.deleteMany({ where: { userId: id } });
    }

    await record(tx, viewer, context, "faculty.removed", "User", id, {
      email: existing.email,
      name: existing.name,
      accountDeleted: untouched,
    });
    return { accountDeleted: untouched };
  });
}

// ─── import ──────────────────────────────────────────────────────────────────

export type ImportRow = {
  prefix?: string | null;
  name: string;
  email: string;
  division?: string | null;
  /** The row's real position in the spreadsheet, so a reported problem can be
   *  found by scrolling to that line rather than counting. */
  sheetRow: number;
};

export type ImportOutcome = {
  added: number;
  updated: number;
  skipped: Array<{ row: number; email: string; reason: string }>;
  divisionsCreated: string[];
};

/**
 * Applies a parsed spreadsheet.
 *
 * A bad row never sinks the import: each is attempted on its own and failures
 * are reported back with the row number, so an operator can fix a typo in one
 * cell instead of re-uploading the whole file blind. Divisions named in the
 * sheet are created on demand — the alternative is asking somebody to hand-type
 * every division before their first import.
 */
/**
 * Bulk faculty import.
 *
 * A university's faculty export is hundreds of rows — the first real one was
 * 403 — so this cannot be a loop of single-row upserts. Doing it that way meant
 * roughly five database round trips per person, which took long enough that the
 * upload timed out before finishing and left the list half-written.
 *
 * Instead the whole sheet is resolved up front (existing accounts in one query,
 * missing divisions in one pass) and written in chunks. A bad row is still
 * reported individually with its spreadsheet line, because the point of the
 * per-row reporting was never the loop — it was telling the operator which cell
 * to fix.
 */
export async function importFaculty(
  rows: ImportRow[],
  viewer: Viewer,
  context: RequestContext = {},
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { added: 0, updated: 0, skipped: [], divisionsCreated: [] };

  // ── 1. Validate every row before touching the database.
  type Ready = {
    sheetRow: number;
    email: string;
    name: string;
    prefix: string | null;
    divisionName: string | null;
  };
  const ready: Ready[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const email = normaliseEmail(row.email ?? "");
    try {
      if (!email) throw new ApiError(400, "MISSING_EMAIL", "Work email is empty");
      if (!row.name?.trim()) throw new ApiError(400, "MISSING_NAME", "Full name is empty");
      assertInstitutional(email);
      if (seen.has(email)) {
        throw new ApiError(400, "DUPLICATE_ROW", `${email} appears more than once in this sheet`);
      }
      seen.add(email);
      ready.push({
        sheetRow: row.sheetRow,
        email,
        name: row.name.trim(),
        prefix: row.prefix?.trim() || null,
        divisionName: row.division?.trim() || null,
      });
    } catch (error) {
      outcome.skipped.push({
        row: row.sheetRow,
        email: email || "(blank)",
        reason: error instanceof ApiError ? error.message : "Could not be imported",
      });
    }
  }
  if (ready.length === 0) {
    await invalidate("reference:*");
    return outcome;
  }

  // ── 2. Resolve divisions, creating the ones the sheet introduces.
  const divisionIds = new Map<string, string>();
  for (const division of await prisma.division.findMany()) {
    divisionIds.set(division.name.trim().toLowerCase(), division.id);
  }
  const missing = [
    ...new Set(
      ready
        .map((entry) => entry.divisionName)
        .filter((name): name is string => Boolean(name))
        .filter((name) => !divisionIds.has(name.toLowerCase())),
    ),
  ];
  for (const name of missing) {
    const created = await prisma.division.create({ data: { name } });
    divisionIds.set(name.toLowerCase(), created.id);
    outcome.divisionsCreated.push(created.name);
  }

  // ── 3. One query for every account the sheet mentions.
  const existing = new Map(
    (
      await prisma.user.findMany({
        where: { email: { in: ready.map((entry) => entry.email) } },
        select: { id: true, email: true, roles: true, deletedAt: true },
      })
    ).map((user) => [user.email, user]),
  );

  const creates: Array<Ready & { id: string; divisionId: string | null }> = [];
  const updates: Array<Ready & { id: string; roles: UserRole[]; divisionId: string | null }> = [];
  for (const entry of ready) {
    const divisionId = entry.divisionName
      ? (divisionIds.get(entry.divisionName.toLowerCase()) ?? null)
      : null;
    const account = existing.get(entry.email);
    if (account?.deletedAt) {
      outcome.skipped.push({
        row: entry.sheetRow,
        email: entry.email,
        reason: "That address belongs to a removed account and cannot be reused here",
      });
      continue;
    }
    if (account) {
      updates.push({
        ...entry,
        id: account.id,
        roles: [...new Set([...account.roles, UserRole.FACULTY_MENTOR])],
        divisionId,
      });
    } else {
      // Ids are generated here so the profile rows can be written in the same
      // batch as the accounts, without reading them back.
      creates.push({ ...entry, id: crypto.randomUUID(), divisionId });
    }
  }

  // ── 4. Write in chunks, so one oversized sheet cannot hold a single
  //       transaction open for the whole import.
  const CHUNK = 100;
  for (let offset = 0; offset < creates.length; offset += CHUNK) {
    const batch = creates.slice(offset, offset + CHUNK);
    await prisma.$transaction([
      prisma.user.createMany({
        data: batch.map((entry) => ({
          id: entry.id,
          email: entry.email,
          name: entry.name,
          roles: [UserRole.FACULTY_MENTOR],
          // Faculty have nothing to onboard, and no googleSubject: their first
          // genuine Google sign-in adopts the account.
          profileComplete: true,
        })),
      }),
      prisma.facultyProfile.createMany({
        data: batch.map((entry) => ({
          userId: entry.id,
          prefix: entry.prefix,
          divisionId: entry.divisionId,
        })),
      }),
      prisma.auditLog.createMany({
        data: batch.map((entry) => ({
          actorUserId: viewer.id,
          action: "faculty.added",
          entityType: "User",
          entityId: entry.id,
          metadata: { email: entry.email, name: entry.name, divisionId: entry.divisionId },
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        })),
      }),
    ]);
    outcome.added += batch.length;
  }

  for (let offset = 0; offset < updates.length; offset += CHUNK) {
    const batch = updates.slice(offset, offset + CHUNK);
    await prisma.$transaction([
      ...batch.map((entry) =>
        prisma.user.update({
          where: { id: entry.id },
          data: {
            name: entry.name,
            roles: entry.roles,
            isActive: true,
            profileComplete: true,
          },
        }),
      ),
      ...batch.map((entry) =>
        prisma.facultyProfile.upsert({
          where: { userId: entry.id },
          update: { prefix: entry.prefix, divisionId: entry.divisionId },
          create: { userId: entry.id, prefix: entry.prefix, divisionId: entry.divisionId },
        }),
      ),
      prisma.auditLog.createMany({
        data: batch.map((entry) => ({
          actorUserId: viewer.id,
          action: "faculty.updated",
          entityType: "User",
          entityId: entry.id,
          metadata: { email: entry.email, name: entry.name, divisionId: entry.divisionId },
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        })),
      }),
    ]);
    outcome.updated += batch.length;
  }

  await invalidate("reference:*");
  return outcome;
}
