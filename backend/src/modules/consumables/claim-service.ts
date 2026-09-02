import crypto from "node:crypto";
import { ConsumableClaimStatus, Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";

type Viewer = NonNullable<Express.Request["user"]>;
type RequestContext = { requestId?: string; ipAddress?: string; userAgent?: string };

/** Claims that still count against a project's approved allowance. */
const committedStatuses = [ConsumableClaimStatus.PENDING, ConsumableClaimStatus.ISSUED];

/**
 * What a project may still claim.
 *
 * The allowance is the quantity the mentor approved on the project. Anything
 * already claimed — issued *or* still pending — is subtracted, so a team cannot
 * get a second helping by claiming twice before the desk answers. A material
 * with nothing left to claim is returned with `remaining: 0` rather than
 * omitted, because "you have taken all of your filament" is information.
 */
export async function allowanceFor(projectId: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      members: { select: { userId: true, status: true } },
      consumableRequirements: { include: { consumable: true } },
    },
  });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  assertTeamMember(project, viewer);

  const claims = await prisma.consumableClaim.groupBy({
    by: ["consumableId", "status"],
    where: { projectId, status: { in: committedStatuses } },
    _sum: { quantity: true },
    orderBy: { consumableId: "asc" },
  });
  const taken = new Map<string, { pending: number; issued: number }>();
  for (const row of claims) {
    const entry = taken.get(row.consumableId) ?? { pending: 0, issued: 0 };
    if (row.status === ConsumableClaimStatus.PENDING) entry.pending += row._sum.quantity ?? 0;
    else entry.issued += row._sum.quantity ?? 0;
    taken.set(row.consumableId, entry);
  }

  return project.consumableRequirements.map((requirement) => {
    const { consumable } = requirement;
    const approved = Number(requirement.expectedQuantity ?? 0);
    const entry = taken.get(consumable.id) ?? { pending: 0, issued: 0 };
    const remaining = Math.max(0, approved - entry.pending - entry.issued);
    return {
      consumableId: consumable.id,
      name: consumable.name,
      unit: consumable.unit,
      variant: requirement.variant,
      variants: consumable.variants,
      approvedQuantity: approved,
      pendingQuantity: entry.pending,
      issuedQuantity: entry.issued,
      remainingQuantity: remaining,
      stockQuantity: consumable.stockQuantity,
      // Claimable only when the project still has allowance *and* the shelf has
      // the material. Both limits are real; showing one without the other would
      // let a student claim something that cannot be handed over.
      claimable: remaining > 0 && consumable.isActive && consumable.stockQuantity > 0,
    };
  });
}

/** A student claims material during a session. */
export async function create(
  viewer: Viewer,
  data: {
    projectId: string;
    consumableId: string;
    quantity: number;
    variant?: string | null;
    bookingId?: string | null;
    note?: string | null;
    idempotencyKey: string;
  },
  context: RequestContext = {},
) {
  const replay = await prisma.consumableClaim.findUnique({
    where: {
      claimedById_idempotencyKey: {
        claimedById: viewer.id,
        idempotencyKey: data.idempotencyKey,
      },
    },
  });
  if (replay) return { claim: claimDto(replay), replayed: true };

  const claim = await prisma.$transaction(
    async (tx) => {
      // Lock the project row so two teammates claiming at once cannot both pass
      // the allowance check.
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${data.projectId}::uuid FOR UPDATE`;

      const project = await tx.project.findFirst({
        where: { id: data.projectId, deletedAt: null },
        include: {
          members: { select: { userId: true, status: true } },
          consumableRequirements: {
            where: { consumableId: data.consumableId },
            include: { consumable: true },
          },
        },
      });
      if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
      assertTeamMember(project, viewer);
      if (project.status !== ProjectStatus.VERIFIED) {
        throw new ApiError(
          409,
          "PROJECT_NOT_VERIFIED",
          "Materials can be claimed only for a verified project",
        );
      }

      const requirement = project.consumableRequirements[0];
      if (!requirement) {
        throw new ApiError(
          400,
          "CONSUMABLE_NOT_IN_PROJECT",
          "This material is not part of your project's approved plan",
        );
      }
      const consumable = requirement.consumable;
      if (!consumable.isActive) {
        throw new ApiError(409, "CONSUMABLE_INACTIVE", `${consumable.name} is no longer stocked`);
      }

      const approved = Number(requirement.expectedQuantity ?? 0);
      const committed = await tx.consumableClaim.aggregate({
        where: {
          projectId: data.projectId,
          consumableId: data.consumableId,
          status: { in: committedStatuses },
        },
        _sum: { quantity: true },
      });
      const alreadyClaimed = committed._sum.quantity ?? 0;
      const remaining = approved - alreadyClaimed;
      if (data.quantity > remaining) {
        throw new ApiError(
          409,
          "CLAIM_EXCEEDS_APPROVED",
          remaining <= 0
            ? `Your project has already claimed all ${approved} ${consumable.unit} of ${consumable.name} it was approved for.`
            : `Only ${remaining} ${consumable.unit} of ${consumable.name} remain on your approved plan.`,
          [{ approved, alreadyClaimed, remaining: Math.max(0, remaining) }],
        );
      }

      // Stock is checked here as a courtesy so a student is not left waiting for
      // a rejection; it is checked again, authoritatively, at issue time.
      if (consumable.stockQuantity < data.quantity) {
        throw new ApiError(
          409,
          "CONSUMABLE_OUT_OF_STOCK",
          `Only ${consumable.stockQuantity} ${consumable.unit} of ${consumable.name} remain in the MakerSpace.`,
        );
      }

      const variant = data.variant ?? requirement.variant ?? null;
      if (variant && consumable.variants.length > 0 && !consumable.variants.includes(variant)) {
        throw new ApiError(
          400,
          "INVALID_VARIANT",
          `${variant} is not a form of ${consumable.name}`,
        );
      }

      const created = await tx.consumableClaim.create({
        data: {
          labId: project.labId,
          projectId: project.id,
          consumableId: consumable.id,
          bookingId: data.bookingId ?? null,
          claimedById: viewer.id,
          quantity: data.quantity,
          variant,
          note: data.note ?? null,
          idempotencyKey: data.idempotencyKey,
          consumableNameSnapshot: consumable.name,
          unitSnapshot: consumable.unit,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: viewer.id,
          action: "consumable.claimed",
          entityType: "ConsumableClaim",
          entityId: created.id,
          metadata: {
            projectId: project.id,
            consumableId: consumable.id,
            quantity: data.quantity,
            approved,
            alreadyClaimed,
          },
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  return { claim: claimDto(claim), replayed: false };
}

/**
 * The desk answers a claim.
 *
 * Issuing spends stock in the same transaction that marks the claim issued, so
 * the shelf count and the record cannot disagree. Nothing returns that stock:
 * material handed over is gone, and only a restock raises the count again.
 */
export async function decide(
  id: string,
  decision: "ISSUED" | "REJECTED",
  reason: string | null | undefined,
  viewer: Viewer,
  context: RequestContext = {},
) {
  const claim = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.consumableClaim.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Claim not found");
      if (existing.status !== ConsumableClaimStatus.PENDING) {
        throw new ApiError(
          409,
          "CLAIM_ALREADY_DECIDED",
          `This claim was already ${existing.status.toLowerCase()}`,
        );
      }

      if (decision === "ISSUED") {
        // Conditional decrement: the update matches only while enough stock
        // remains, so two assistants issuing at once cannot drive it negative.
        const spent = await tx.consumable.updateMany({
          where: { id: existing.consumableId, stockQuantity: { gte: existing.quantity } },
          data: { stockQuantity: { decrement: existing.quantity } },
        });
        if (spent.count === 0) {
          const current = await tx.consumable.findUnique({
            where: { id: existing.consumableId },
            select: { stockQuantity: true, unit: true, name: true },
          });
          throw new ApiError(
            409,
            "CONSUMABLE_OUT_OF_STOCK",
            `Only ${current?.stockQuantity ?? 0} ${current?.unit ?? "units"} of ${
              current?.name ?? "this material"
            } remain.`,
          );
        }
      }

      const updated = await tx.consumableClaim.update({
        where: { id },
        data: {
          status:
            decision === "ISSUED" ? ConsumableClaimStatus.ISSUED : ConsumableClaimStatus.REJECTED,
          decidedById: viewer.id,
          decidedAt: new Date(),
          decisionReason: reason ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: viewer.id,
          action: decision === "ISSUED" ? "consumable.issued" : "consumable.claim_rejected",
          entityType: "ConsumableClaim",
          entityId: id,
          metadata: { quantity: existing.quantity, consumableId: existing.consumableId, reason },
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      await tx.notification.create({
        data: {
          userId: existing.claimedById,
          type: decision === "ISSUED" ? "CONSUMABLE_ISSUED" : "CONSUMABLE_REJECTED",
          title:
            decision === "ISSUED"
              ? `${existing.consumableNameSnapshot} issued`
              : `${existing.consumableNameSnapshot} claim declined`,
          body:
            decision === "ISSUED"
              ? `${existing.quantity} ${existing.unitSnapshot} collected at the MakerSpace desk.`
              : (reason ?? "Ask the MakerSpace desk for details."),
          href: "/book",
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
  return claimDto(claim);
}

/** A student withdraws their own claim before the desk answers. */
export async function cancel(id: string, viewer: Viewer) {
  const existing = await prisma.consumableClaim.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Claim not found");
  if (existing.claimedById !== viewer.id) {
    throw new ApiError(403, "FORBIDDEN", "You can only withdraw your own claim");
  }
  if (existing.status !== ConsumableClaimStatus.PENDING) {
    throw new ApiError(409, "CLAIM_ALREADY_DECIDED", "This claim has already been answered");
  }
  const updated = await prisma.consumableClaim.update({
    where: { id },
    data: {
      status: ConsumableClaimStatus.CANCELLED,
      decidedAt: new Date(),
      decisionReason: "Withdrawn by the team",
    },
  });
  return claimDto(updated);
}

export async function list(query: Record<string, unknown>, viewer: Viewer, operational: boolean) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 50), 100);
  const where: Prisma.ConsumableClaimWhereInput = {
    ...(query.projectId ? { projectId: String(query.projectId) } : {}),
    ...(query.bookingId ? { bookingId: String(query.bookingId) } : {}),
    ...(query.status ? { status: query.status as ConsumableClaimStatus } : {}),
    // A student sees their team's claims; the desk sees the whole lab.
    ...(operational
      ? {}
      : { project: { members: { some: { userId: viewer.id, status: "ACCEPTED" } } } }),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.consumableClaim.count({ where }),
    prisma.consumableClaim.findMany({
      where,
      include: {
        project: { select: { title: true } },
        claimedBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    data: rows.map((row) => ({
      ...claimDto(row),
      projectTitle: row.project.title,
      claimedByName: row.claimedBy.name,
    })),
    meta: meta(page, limit, total),
  };
}

function assertTeamMember(
  project: { creatorId: string; members: Array<{ userId: string | null; status: string }> },
  viewer: Viewer,
) {
  const member =
    project.creatorId === viewer.id ||
    project.members.some((entry) => entry.userId === viewer.id && entry.status === "ACCEPTED");
  if (!member) {
    throw new ApiError(403, "FORBIDDEN", "Only the project team can claim its materials");
  }
}

function claimDto(claim: {
  id: string;
  projectId: string;
  consumableId: string;
  bookingId: string | null;
  quantity: number;
  variant: string | null;
  status: ConsumableClaimStatus;
  note: string | null;
  decisionReason: string | null;
  consumableNameSnapshot: string;
  unitSnapshot: string;
  decidedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: claim.id,
    projectId: claim.projectId,
    consumableId: claim.consumableId,
    bookingId: claim.bookingId,
    quantity: claim.quantity,
    variant: claim.variant,
    status: claim.status,
    statusLabel: statusLabel(claim.status),
    note: claim.note,
    decisionReason: claim.decisionReason,
    name: claim.consumableNameSnapshot,
    unit: claim.unitSnapshot,
    decidedAt: claim.decidedAt?.toISOString() ?? null,
    createdAt: claim.createdAt.toISOString(),
  };
}

function statusLabel(status: ConsumableClaimStatus) {
  if (status === ConsumableClaimStatus.PENDING) return "Awaiting the desk";
  if (status === ConsumableClaimStatus.ISSUED) return "Collected";
  if (status === ConsumableClaimStatus.REJECTED) return "Declined";
  return "Withdrawn";
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}
