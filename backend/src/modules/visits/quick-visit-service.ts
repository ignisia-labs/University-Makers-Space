import {
  BookingCancellationSource,
  DeliveryStatus,
  NotificationChannel,
  Prisma,
  QuickVisitStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../config/db.js";
import { logger } from "../../config/logger.js";
import { hasPermission } from "../../config/permissions.js";
import { redis } from "../../config/redis.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { quickVisitDto } from "./visit-serializers.js";
import {
  fingerprint,
  formatWindow,
  isSerializationConflict,
  isUniqueConflict,
  lockQuickVisit,
  lockSlot,
  maxTransactionAttempts,
  transactionOptions,
  violated,
  waitForSerializationRetry,
  type RequestContext,
  type Viewer,
} from "./visit-shared.js";

/** Statuses that still hold a seat in the slot's Quick Visit capacity. */
export const liveQuickVisitStatuses = [
  QuickVisitStatus.REQUESTED,
  QuickVisitStatus.CONFIRMED,
  QuickVisitStatus.ACTIVE,
] as const;

type QuickVisitRecord = Prisma.QuickVisitGetPayload<Record<string, never>>;
type CreateInput = {
  labSlotId: string;
  purpose: string;
  idempotencyKey: string;
};

export async function create(viewer: Viewer, data: CreateInput, context: RequestContext = {}) {
  const requestFingerprint = creationFingerprint(data);
  const replay = await findCreationReplay(viewer.id, data.idempotencyKey);
  if (replay) {
    assertCreationFingerprint(replay, requestFingerprint);
    return { quickVisit: quickVisitDto(replay, access(viewer)), replayed: true as const };
  }

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Serialising on the slot row is what makes the capacity count below
        // exact: concurrent requesters queue here rather than all reading the
        // same pre-insert count.
        await lockSlot(tx, data.labSlotId);

        const existing = await tx.quickVisit.findUnique({
          where: {
            userId_idempotencyKey: { userId: viewer.id, idempotencyKey: data.idempotencyKey },
          },
        });
        if (existing) {
          assertCreationFingerprint(existing, requestFingerprint);
          return { quickVisit: existing, replayed: true as const };
        }

        const now = new Date();
        const [slot, user] = await Promise.all([
          tx.labSlot.findUnique({ where: { id: data.labSlotId }, include: { lab: true } }),
          tx.user.findUnique({
            where: { id: viewer.id },
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              deletedAt: true,
              roles: true,
              profileComplete: true,
              studentProfile: { select: { prn: true } },
            },
          }),
        ]);
        if (!slot) throw new ApiError(404, "NOT_FOUND", "MakerSpace slot not found");
        if (!user || !user.isActive || user.deletedAt) {
          throw new ApiError(403, "ACCOUNT_DISABLED", "This account can no longer request visits");
        }
        if (user.roles.includes(UserRole.STUDENT) && !user.profileComplete) {
          throw new ApiError(
            403,
            "PROFILE_INCOMPLETE",
            "Complete your student profile before requesting a Quick Visit",
          );
        }
        if (!slot.lab.isActive || !slot.lab.quickVisitsEnabled) {
          throw new ApiError(
            409,
            "QUICK_VISITS_DISABLED",
            "Quick Visits are not available for this MakerSpace right now",
          );
        }
        if (slot.status !== "OPEN") {
          throw new ApiError(409, "SLOT_NOT_OPEN", "This slot is not open for visits");
        }
        if (slot.startsAt <= now) {
          throw new ApiError(
            409,
            "SLOT_ALREADY_STARTED",
            "This slot has already started — ask the Lab Assistant to admit you",
          );
        }
        if (slot.quickVisitCapacity <= 0) {
          throw new ApiError(
            409,
            "QUICK_VISIT_CAPACITY_EXCEEDED",
            "Quick Visit capacity for this slot is full",
          );
        }

        const taken = await tx.quickVisit.count({
          where: { labSlotId: slot.id, status: { in: [...liveQuickVisitStatuses] } },
        });
        if (taken >= slot.quickVisitCapacity) {
          throw new ApiError(
            409,
            "QUICK_VISIT_CAPACITY_EXCEEDED",
            "Quick Visit capacity for this slot is full",
          );
        }

        const status = slot.lab.quickVisitsRequireApproval
          ? QuickVisitStatus.REQUESTED
          : QuickVisitStatus.CONFIRMED;
        const created = await tx.quickVisit.create({
          data: {
            labId: slot.labId,
            labSlotId: slot.id,
            userId: user.id,
            idempotencyKey: data.idempotencyKey,
            creationRequestFingerprint: requestFingerprint,
            purpose: data.purpose,
            status,
            labNameSnapshot: slot.lab.name,
            slotStartsAtSnapshot: slot.startsAt,
            slotEndsAtSnapshot: slot.endsAt,
            timeZoneSnapshot: slot.lab.timeZone,
            userNameSnapshot: user.name,
            userEmailSnapshot: user.email,
            userPrnSnapshot: user.studentProfile?.prn ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: viewer.id,
            action: "quick_visit.created",
            entityType: "QuickVisit",
            entityId: created.id,
            metadata: { labSlotId: slot.id, status, purpose: data.purpose },
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
        return { quickVisit: created, replayed: false as const };
      }, transactionOptions);

      await publishOccupancy(result.quickVisit.labId, "QUICK_VISIT_CREATED");
      return {
        quickVisit: quickVisitDto(result.quickVisit, access(viewer)),
        replayed: result.replayed,
      };
    } catch (error) {
      const recovered = await recoverCreationConflict(error, viewer, data, requestFingerprint);
      if (recovered) return recovered;
      if (isSerializationConflict(error) && attempt < maxTransactionAttempts) {
        await waitForSerializationRetry(attempt);
        continue;
      }
      throw error;
    }
  }
  throw new ApiError(
    409,
    "QUICK_VISIT_CONTENTION",
    "The MakerSpace is busy right now — please try again",
  );
}

export async function list(query: Record<string, unknown>, viewer: Viewer) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const operational = hasPermission(viewer.roles, "visit.read.operational");
  const scope = String(query.scope ?? "all") as "upcoming" | "past" | "all";
  const now = new Date();

  const where: Prisma.QuickVisitWhereInput = {
    AND: [
      operational ? (query.userId ? { userId: String(query.userId) } : {}) : { userId: viewer.id },
      scope === "upcoming"
        ? {
            status: { in: [...liveQuickVisitStatuses] },
            slotEndsAtSnapshot: { gte: now },
          }
        : scope === "past"
          ? {
              OR: [
                {
                  status: {
                    in: [
                      QuickVisitStatus.COMPLETED,
                      QuickVisitStatus.CANCELLED,
                      QuickVisitStatus.NO_SHOW,
                    ],
                  },
                },
                { slotEndsAtSnapshot: { lt: now } },
              ],
            }
          : {},
      query.labId ? { labId: String(query.labId) } : {},
      query.labSlotId ? { labSlotId: String(query.labSlotId) } : {},
      query.status ? { status: query.status as QuickVisitStatus } : {},
    ],
  };
  const order = scope === "upcoming" ? "asc" : "desc";
  const [total, rows] = await prisma.$transaction([
    prisma.quickVisit.count({ where }),
    prisma.quickVisit.findMany({
      where,
      orderBy: [{ slotStartsAtSnapshot: order }, { id: order }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    data: rows.map((row) => quickVisitDto(row, access(viewer))),
    meta: meta(page, limit, total),
  };
}

export async function get(id: string, viewer: Viewer) {
  const quickVisit = await prisma.quickVisit.findUnique({ where: { id } });
  if (!quickVisit) throw new ApiError(404, "NOT_FOUND", "Quick Visit not found");
  assertCanRead(quickVisit, viewer);
  return quickVisitDto(quickVisit, access(viewer));
}

export async function decide(
  id: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | null | undefined,
  viewer: Viewer,
  context: RequestContext = {},
) {
  if (decision === "REJECTED" && !reason) {
    throw new ApiError(400, "DECISION_REASON_REQUIRED", "A reason is required to reject a request");
  }
  const updated = await prisma.$transaction(async (tx) => {
    await lockQuickVisit(tx, id);
    const existing = await tx.quickVisit.findUniqueOrThrow({ where: { id } });
    if (existing.status !== QuickVisitStatus.REQUESTED) {
      throw new ApiError(
        409,
        "QUICK_VISIT_ALREADY_DECIDED",
        "This Quick Visit request has already been decided",
      );
    }
    const now = new Date();
    if (existing.slotEndsAtSnapshot <= now) {
      throw new ApiError(409, "QUICK_VISIT_EXPIRED", "This Quick Visit slot has already ended");
    }

    if (decision === "APPROVED") {
      // Re-check capacity at approval time: seats may have been taken since the
      // request was filed.
      await lockSlot(tx, existing.labSlotId);
      const slot = await tx.labSlot.findUniqueOrThrow({ where: { id: existing.labSlotId } });
      const taken = await tx.quickVisit.count({
        where: {
          labSlotId: existing.labSlotId,
          status: { in: [QuickVisitStatus.CONFIRMED, QuickVisitStatus.ACTIVE] },
        },
      });
      if (taken >= slot.quickVisitCapacity) {
        throw new ApiError(
          409,
          "QUICK_VISIT_CAPACITY_EXCEEDED",
          "Quick Visit capacity for this slot is full",
        );
      }
    }

    const next = await tx.quickVisit.update({
      where: { id },
      data:
        decision === "APPROVED"
          ? {
              status: QuickVisitStatus.CONFIRMED,
              decidedById: viewer.id,
              decidedAt: now,
              decisionReason: reason ?? null,
            }
          : {
              status: QuickVisitStatus.CANCELLED,
              decidedById: viewer.id,
              decidedAt: now,
              decisionReason: reason ?? null,
              cancelledById: viewer.id,
              cancelledAt: now,
              cancellationReason: reason ?? "Request rejected",
              cancellationSource: cancellationSourceFor(viewer, true),
            },
    });

    await createNotifications(tx, {
      userIds: [existing.userId],
      type: decision === "APPROVED" ? "QUICK_VISIT_APPROVED" : "QUICK_VISIT_REJECTED",
      title:
        decision === "APPROVED"
          ? `Quick Visit approved — ${existing.labNameSnapshot}`
          : `Quick Visit declined — ${existing.labNameSnapshot}`,
      body: `${formatWindow(existing.slotStartsAtSnapshot, existing.slotEndsAtSnapshot, existing.timeZoneSnapshot)}${reason ? ` · ${reason}` : ""}`,
      href: `/visits/quick/${existing.id}`,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: decision === "APPROVED" ? "quick_visit.approved" : "quick_visit.rejected",
        entityType: "QuickVisit",
        entityId: id,
        metadata: { from: existing.status, to: next.status, reason: reason ?? null },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return next;
  }, transactionOptions);

  await publishOccupancy(updated.labId, "QUICK_VISIT_DECIDED");
  return quickVisitDto(updated, access(viewer));
}

export async function cancel(
  id: string,
  reason: string,
  idempotencyKey: string,
  viewer: Viewer,
  context: RequestContext = {},
) {
  const requestFingerprint = cancellationFingerprint(id, reason);
  const replay = await prisma.quickVisit.findFirst({
    where: { cancelledById: viewer.id, cancellationIdempotencyKey: idempotencyKey },
  });
  if (replay) return cancellationReplay(replay, requestFingerprint, idempotencyKey, viewer);

  const updated = await prisma.$transaction(async (tx) => {
    await lockQuickVisit(tx, id);
    const existing = await tx.quickVisit.findUniqueOrThrow({ where: { id } });
    const canManage = hasPermission(viewer.roles, "visit.manage");
    assertCanCancel(existing, viewer, canManage);

    if (existing.status === QuickVisitStatus.CANCELLED) {
      throw new ApiError(
        409,
        "QUICK_VISIT_ALREADY_CANCELLED",
        "This Quick Visit has already been cancelled",
      );
    }
    if (
      existing.status === QuickVisitStatus.COMPLETED ||
      existing.status === QuickVisitStatus.NO_SHOW
    ) {
      throw new ApiError(409, "QUICK_VISIT_CLOSED", "This Quick Visit is already closed");
    }
    if (existing.status === QuickVisitStatus.ACTIVE) {
      throw new ApiError(
        409,
        "QUICK_VISIT_IN_PROGRESS",
        "This visit is in progress — check the person out instead",
      );
    }
    const now = new Date();
    if (!canManage && existing.slotStartsAtSnapshot <= now) {
      throw new ApiError(
        409,
        "QUICK_VISIT_CANCELLATION_WINDOW_CLOSED",
        "This slot has already started — contact the Lab Assistant",
      );
    }

    const next = await tx.quickVisit.update({
      where: { id },
      data: {
        status: QuickVisitStatus.CANCELLED,
        cancelledById: viewer.id,
        cancelledAt: now,
        cancellationReason: reason,
        cancellationSource: cancellationSourceFor(viewer, canManage),
        cancellationIdempotencyKey: idempotencyKey,
        cancellationRequestFingerprint: requestFingerprint,
      },
    });

    if (existing.userId !== viewer.id) {
      await createNotifications(tx, {
        userIds: [existing.userId],
        type: "QUICK_VISIT_CANCELLED",
        title: `Quick Visit cancelled — ${existing.labNameSnapshot}`,
        body: `${formatWindow(existing.slotStartsAtSnapshot, existing.slotEndsAtSnapshot, existing.timeZoneSnapshot)} · ${reason}`,
        href: `/visits/quick/${existing.id}`,
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "quick_visit.cancelled",
        entityType: "QuickVisit",
        entityId: id,
        metadata: { from: existing.status, reason },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return next;
  }, transactionOptions);

  await publishOccupancy(updated.labId, "QUICK_VISIT_CANCELLED");
  return { quickVisit: quickVisitDto(updated, access(viewer)), replayed: false as const };
}

// ─── internals ───────────────────────────────────────────────────────────────

function access(viewer: Viewer) {
  const operational = hasPermission(viewer.roles, "visit.read.operational");
  return {
    viewerId: viewer.id,
    canManage: hasPermission(viewer.roles, "visit.manage"),
    canDecide: hasPermission(viewer.roles, "quick_visit.decide"),
    canCancelOwn: hasPermission(viewer.roles, "visit.cancel.own"),
    canReadPii: operational,
  };
}

function assertCanRead(quickVisit: { userId: string }, viewer: Viewer) {
  if (quickVisit.userId !== viewer.id && !hasPermission(viewer.roles, "visit.read.operational")) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this Quick Visit");
  }
}

function assertCanCancel(quickVisit: { userId: string }, viewer: Viewer, canManage: boolean) {
  const canCancelOwn =
    quickVisit.userId === viewer.id && hasPermission(viewer.roles, "visit.cancel.own");
  if (!canManage && !canCancelOwn) {
    throw new ApiError(403, "FORBIDDEN", "You cannot cancel this Quick Visit");
  }
}

function creationFingerprint(data: CreateInput) {
  return fingerprint({ version: 1, labSlotId: data.labSlotId, purpose: data.purpose });
}

function cancellationFingerprint(id: string, reason: string) {
  return fingerprint({ version: 1, quickVisitId: id, reason });
}

function findCreationReplay(userId: string, idempotencyKey: string) {
  return prisma.quickVisit.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });
}

function assertCreationFingerprint(record: QuickVisitRecord, expected: string) {
  if (record.creationRequestFingerprint !== expected) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This request key was already used with different Quick Visit details",
    );
  }
}

function cancellationReplay(
  record: QuickVisitRecord,
  expected: string,
  idempotencyKey: string,
  viewer: Viewer,
) {
  assertCanCancel(record, viewer, hasPermission(viewer.roles, "visit.manage"));
  if (record.cancelledById !== viewer.id || record.cancellationIdempotencyKey !== idempotencyKey) {
    throw new ApiError(
      409,
      "QUICK_VISIT_ALREADY_CANCELLED",
      "This Quick Visit has already been cancelled",
    );
  }
  if (record.cancellationRequestFingerprint && record.cancellationRequestFingerprint !== expected) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This cancellation key was already used with a different reason",
    );
  }
  return { quickVisit: quickVisitDto(record, access(viewer)), replayed: true as const };
}

async function recoverCreationConflict(
  error: unknown,
  viewer: Viewer,
  data: CreateInput,
  expected: string,
) {
  if (!isUniqueConflict(error) && !isSerializationConflict(error)) return null;
  const replay = await findCreationReplay(viewer.id, data.idempotencyKey);
  if (replay) {
    assertCreationFingerprint(replay, expected);
    return { quickVisit: quickVisitDto(replay, access(viewer)), replayed: true as const };
  }
  // `quick_visits_live_slot_user_uniq` — one live Quick Visit per person per slot.
  if (isUniqueConflict(error) && violated(error, "lab_slot_id", "user_id")) {
    throw new ApiError(
      409,
      "QUICK_VISIT_ALREADY_REQUESTED",
      "You already have a Quick Visit for this slot",
    );
  }
  return null;
}

function cancellationSourceFor(viewer: Viewer, canManage: boolean): BookingCancellationSource {
  if (!canManage) return BookingCancellationSource.STUDENT;
  if (viewer.roles.includes(UserRole.SUPER_ADMIN)) return BookingCancellationSource.SUPER_ADMIN;
  if (viewer.roles.includes(UserRole.ADMIN)) return BookingCancellationSource.ADMIN;
  return BookingCancellationSource.LAB_ASSISTANT;
}

async function createNotifications(
  tx: Prisma.TransactionClient,
  event: { userIds: string[]; type: string; title: string; body: string; href: string },
) {
  const userIds = [...new Set(event.userIds)];
  if (!userIds.length) return;
  const notifications = await tx.notification.createManyAndReturn({
    data: userIds.map((userId) => ({
      userId,
      type: event.type,
      title: event.title,
      body: event.body,
      href: event.href,
    })),
    select: { id: true },
  });
  await tx.notificationDelivery.createMany({
    data: notifications.map((notification) => ({
      notificationId: notification.id,
      channel: NotificationChannel.EMAIL,
      status: DeliveryStatus.PENDING,
    })),
    skipDuplicates: true,
  });
}

export async function publishOccupancy(labId: string, type: string) {
  try {
    await redis.publish(`lab:${labId}:occupancy`, JSON.stringify({ type, labId }));
  } catch (error) {
    logger.warn({ err: error, labId }, "Occupancy change committed but publication failed");
  }
}
