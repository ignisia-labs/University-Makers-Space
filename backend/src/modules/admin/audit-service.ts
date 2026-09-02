import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { meta } from "../../utils/pagination.js";
import type { Viewer } from "../visits/visit-shared.js";

/**
 * Audit review.
 *
 * The audit trail is append-only by policy: there is deliberately no update or
 * delete path anywhere in this module. Reads are keyset-friendly — every filter
 * combination below is served by one of the three composite indexes on
 * `audit_logs` — and the page size is hard-capped by the route schema.
 */
export async function list(query: Record<string, unknown>, _viewer: Viewer) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 50);

  const where: Prisma.AuditLogWhereInput = {
    AND: [
      query.actorUserId ? { actorUserId: String(query.actorUserId) } : {},
      query.action ? { action: String(query.action) } : {},
      query.entityType ? { entityType: String(query.entityType) } : {},
      query.entityId ? { entityId: String(query.entityId) } : {},
      query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(String(query.from)) } : {}),
              ...(query.to ? { lte: new Date(String(query.to)) } : {}),
            },
          }
        : {},
    ],
  };

  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        actor: { select: { id: true, name: true, email: true, roles: true } },
      },
    }),
  ]);

  return { data: rows.map(auditDto), meta: meta(page, limit, total) };
}

/** Distinct action names, for populating the review UI's filter control. */
export async function actions(_viewer: Viewer) {
  const rows = await prisma.auditLog.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: 500,
  });
  return rows.map((row) => row.action);
}

type AuditRow = Prisma.AuditLogGetPayload<{
  include: { actor: { select: { id: true; name: true; email: true; roles: true } } };
}>;

export function auditDto(row: AuditRow) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor
      ? { id: row.actor.id, name: row.actor.name, email: row.actor.email, roles: row.actor.roles }
      : null,
  };
}
