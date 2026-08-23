import crypto from "node:crypto";
import {
  BookingCancellationSource,
  BookingStatus,
  DeliveryStatus,
  NotificationChannel,
  Prisma,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../config/db.js";
import { logger } from "../../config/logger.js";
import { hasPermission } from "../../config/permissions.js";
import { redis } from "../../config/redis.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { bookingDto } from "../../utils/serializers.js";
import { addLocalDays, localToday } from "../labs/lab-time.js";

const capacityStatuses = [BookingStatus.CONFIRMED, BookingStatus.ACTIVE];
const terminalStatuses = [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW];
const maxTransactionAttempts = 3;
const maxSerializationBackoffMs = 150;

type Viewer = NonNullable<Express.Request["user"]>;
type BookingRecord = Prisma.BookingGetPayload<{ include: { participants: true } }>;
type RequestContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};
type BookingInput = {
  labSlotId: string;
  projectId: string;
  participantIds: string[];
  idempotencyKey: string;
  notes?: string | null;
};

export async function list(query: Record<string, unknown>, viewer: Viewer) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const scope = String(query.scope ?? "all") as "upcoming" | "past" | "all";
  const now = new Date();
  const operational = hasPermission(viewer.roles, "booking.read.operational");
  const temporalScope: Prisma.BookingWhereInput =
    scope === "upcoming"
      ? { status: { in: capacityStatuses }, slotEndsAtSnapshot: { gte: now } }
      : scope === "past"
        ? {
            OR: [{ status: { in: terminalStatuses } }, { slotEndsAtSnapshot: { lt: now } }],
          }
        : {};
  const where: Prisma.BookingWhereInput = {
    AND: [
      operational
        ? query.userId
          ? { participants: { some: { userId: String(query.userId) } } }
          : {}
        : {
            OR: [{ createdById: viewer.id }, { participants: { some: { userId: viewer.id } } }],
          },
      temporalScope,
    ],
    ...(query.labSlotId ? { labSlotId: String(query.labSlotId) } : {}),
    ...(query.projectId ? { projectId: String(query.projectId) } : {}),
    ...(query.status ? { status: query.status as BookingStatus } : {}),
  };
  const order = scope === "upcoming" ? "asc" : "desc";
  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: { participants: true },
      orderBy: [{ slotStartsAtSnapshot: order }, { id: order }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    data: rows.map((booking) => bookingDto(booking, bookingAccess(viewer))),
    meta: meta(page, limit, total),
  };
}

export async function get(id: string, viewer: Viewer) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!booking) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  assertCanRead(booking, viewer);
  return bookingDto(booking, bookingAccess(viewer));
}

export async function create(viewer: Viewer, data: BookingInput, context: RequestContext = {}) {
  if (new Set(data.participantIds).size !== data.participantIds.length) {
    throw new ApiError(400, "DUPLICATE_PARTICIPANTS", "Each attendee may be selected only once");
  }
  const requestFingerprint = creationFingerprint(data);
  const existing = await findCreationReplay(viewer.id, data.idempotencyKey);
  if (existing) {
    assertCreationFingerprint(existing, requestFingerprint);
    return { booking: bookingDto(existing, bookingAccess(viewer)), replayed: true };
  }

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await lockProject(tx, data.projectId);
          await lockSlot(tx, data.labSlotId);

          const replay = await tx.booking.findUnique({
            where: {
              createdById_idempotencyKey: {
                createdById: viewer.id,
                idempotencyKey: data.idempotencyKey,
              },
            },
            include: { participants: true },
          });
          if (replay) {
            assertCreationFingerprint(replay, requestFingerprint);
            return { booking: replay, replayed: true as const };
          }

          const now = new Date();
          const [slot, project] = await Promise.all([
            tx.labSlot.findUnique({ where: { id: data.labSlotId }, include: { lab: true } }),
            tx.project.findUnique({
              where: { id: data.projectId },
              include: {
                members: {
                  where: { status: ProjectMemberStatus.ACCEPTED, userId: { not: null } },
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        roles: true,
                        isActive: true,
                        deletedAt: true,
                        studentProfile: { select: { prn: true } },
                      },
                    },
                  },
                },
              },
            }),
          ]);
          if (!slot || !slot.lab.isActive) {
            throw new ApiError(404, "NOT_FOUND", "MakerSpace slot not found");
          }
          if (slot.status !== "OPEN") {
            throw new ApiError(409, "SLOT_UNAVAILABLE", "This slot is not open for booking");
          }
          assertSlotInsideBookingWindow(slot, now);
          if (!project || project.deletedAt) {
            throw new ApiError(404, "NOT_FOUND", "Project not found");
          }
          if (project.creatorId !== viewer.id) {
            throw new ApiError(
              403,
              "TEAM_LEADER_REQUIRED",
              "Only the project leader can book a slot",
            );
          }
          if (project.labId !== slot.labId) {
            throw new ApiError(
              400,
              "LAB_MISMATCH",
              "Project and slot must belong to the same MakerSpace",
            );
          }
          if (project.status !== ProjectStatus.VERIFIED) {
            throw new ApiError(
              409,
              "PROJECT_NOT_VERIFIED",
              "This project must be verified before booking",
            );
          }

          const acceptedMembers = new Map(
            project.members.flatMap((member) =>
              member.userId && member.user ? [[member.userId, member] as const] : [],
            ),
          );
          const leaderMembership = project.members.find(
            (member) =>
              member.userId === project.creatorId && member.role === ProjectMemberRole.LEADER,
          );
          if (!leaderMembership?.user || !isActiveStudent(leaderMembership.user)) {
            throw new ApiError(
              409,
              "LEADER_MEMBERSHIP_INVALID",
              "The Team Leader must be an active accepted project member",
            );
          }
          if (
            slot.lab.teamLeaderAttendanceRequired &&
            !data.participantIds.includes(project.creatorId)
          ) {
            throw new ApiError(
              400,
              "TEAM_LEADER_ATTENDANCE_REQUIRED",
              "The Team Leader must attend this booking",
            );
          }

          const selectedMembers = data.participantIds.map((participantId) => {
            const member = acceptedMembers.get(participantId);
            if (!member?.user || !isActiveStudent(member.user)) {
              throw new ApiError(
                400,
                "INVALID_PARTICIPANTS",
                "Every attendee must be an active accepted project member",
              );
            }
            return member;
          });

          if (slot.lab.maxFutureBookingsPerProject !== null) {
            const futureBookings = await tx.booking.count({
              where: {
                projectId: project.id,
                status: { in: capacityStatuses },
                slotEndsAtSnapshot: { gt: now },
              },
            });
            if (futureBookings >= slot.lab.maxFutureBookingsPerProject) {
              throw new ApiError(
                409,
                "PROJECT_BOOKING_LIMIT_REACHED",
                "This project has reached its future booking limit",
              );
            }
          }

          const duplicate = await tx.booking.findFirst({
            where: {
              projectId: project.id,
              labSlotId: slot.id,
              status: { in: capacityStatuses },
            },
            select: { id: true },
          });
          if (duplicate) {
            throw new ApiError(
              409,
              "PROJECT_SLOT_ALREADY_BOOKED",
              "This project already has a live booking for the selected slot",
            );
          }

          const reserved = await tx.booking.aggregate({
            where: { labSlotId: slot.id, status: { in: capacityStatuses } },
            _sum: { attendeeCount: true },
          });
          const placesUsed = reserved._sum.attendeeCount ?? 0;
          const remainingCapacity = Math.max(0, slot.bookingCapacity - placesUsed);
          if (selectedMembers.length > remainingCapacity) {
            throw new ApiError(
              409,
              "SLOT_CAPACITY_EXCEEDED",
              `This slot filled up while you were booking. Only ${remainingCapacity} ${remainingCapacity === 1 ? "place remains" : "places remain"}.`,
              [
                {
                  remainingCapacity,
                  requestedParticipants: selectedMembers.length,
                  labSlotId: slot.id,
                },
              ],
            );
          }

          const actorRole = primaryRole(viewer.roles);
          const created = await tx.booking.create({
            data: {
              labId: slot.labId,
              labSlotId: slot.id,
              projectId: project.id,
              createdById: viewer.id,
              idempotencyKey: data.idempotencyKey,
              creationRequestFingerprint: requestFingerprint,
              attendeeCount: selectedMembers.length,
              notes: data.notes,
              labNameSnapshot: slot.lab.name,
              projectTitleSnapshot: project.title,
              slotStartsAtSnapshot: slot.startsAt,
              slotEndsAtSnapshot: slot.endsAt,
              timeZoneSnapshot: slot.lab.timeZone,
              cancellationWindowHoursSnapshot: slot.lab.cancellationWindowHours,
              participants: {
                create: selectedMembers.map((member) => ({
                  userId: member.userId!,
                  nameSnapshot: member.user!.name,
                  emailSnapshot: member.user!.email,
                  prnSnapshot: member.user!.studentProfile?.prn ?? null,
                  projectRoleSnapshot: member.role,
                })),
              },
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: BookingStatus.CONFIRMED,
                  actorUserId: viewer.id,
                  actorNameSnapshot: viewer.name,
                  actorRoleSnapshot: actorRole,
                  idempotencyKey: data.idempotencyKey,
                },
              },
            },
            include: { participants: true },
          });
          await createBookingNotifications(tx, {
            userIds: selectedMembers.map((member) => member.userId!),
            type: "BOOKING_CONFIRMED",
            title: `${project.title} is booked`,
            body: `${formatBookingWindow(slot.startsAt, slot.endsAt, slot.lab.timeZone)} at ${slot.lab.name}.`,
            href: `/bookings/${created.id}`,
          });
          await tx.auditLog.create({
            data: {
              actorUserId: viewer.id,
              action: "booking.created",
              entityType: "Booking",
              entityId: created.id,
              metadata: {
                projectId: project.id,
                labSlotId: slot.id,
                attendeeCount: selectedMembers.length,
                participantIds: selectedMembers.map((member) => member.userId),
              },
              requestId: context.requestId,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
          });
          return { booking: created, replayed: false as const };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
      if (!result.replayed) await publishAvailability(result.booking, "BOOKING_CREATED");
      return {
        booking: bookingDto(result.booking, bookingAccess(viewer)),
        replayed: result.replayed,
      };
    } catch (error) {
      const recovered = await recoverCreationConflict(error, viewer, data, requestFingerprint);
      if (recovered) return recovered;
      if (isSerializationConflict(error) && attempt < maxTransactionAttempts) {
        await waitForSerializationRetry(attempt);
        continue;
      }
      if (isSerializationConflict(error)) {
        throw new ApiError(
          409,
          "TRANSACTION_CONFLICT",
          "Availability changed during booking. Refresh and try again.",
        );
      }
      throw error;
    }
  }
  throw new ApiError(409, "TRANSACTION_CONFLICT", "Refresh availability and try again");
}

export async function cancel(
  id: string,
  reason: string,
  idempotencyKey: string,
  viewer: Viewer,
  context: RequestContext = {},
) {
  const requestFingerprint = cancellationFingerprint(id, reason);
  const keyOwner = await prisma.booking.findFirst({
    where: { cancelledById: viewer.id, cancellationIdempotencyKey: idempotencyKey },
    include: { participants: true },
  });
  if (keyOwner && keyOwner.id !== id) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This cancellation key was already used for another booking",
    );
  }
  if (keyOwner) {
    return cancellationReplay(keyOwner, requestFingerprint, idempotencyKey, viewer);
  }

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await lockBooking(tx, id);
          const booking = await tx.booking.findUnique({
            where: { id },
            include: { participants: true },
          });
          if (!booking) throw new ApiError(404, "NOT_FOUND", "Booking not found");
          const access = bookingAccess(viewer);
          assertCanCancel(booking, viewer, access.canManage);

          if (booking.status === BookingStatus.CANCELLED) {
            if (
              booking.cancelledById === viewer.id &&
              booking.cancellationIdempotencyKey === idempotencyKey
            ) {
              assertCancellationFingerprint(booking, requestFingerprint);
              return { booking, replayed: true as const };
            }
            throw new ApiError(
              409,
              "BOOKING_ALREADY_CANCELLED",
              "This booking has already been cancelled",
            );
          }
          if (booking.status !== BookingStatus.CONFIRMED) {
            throw new ApiError(
              409,
              "INVALID_BOOKING_STATE",
              "Only confirmed bookings can be cancelled",
            );
          }
          const cancellationDeadline = new Date(
            booking.slotStartsAtSnapshot.getTime() -
              booking.cancellationWindowHoursSnapshot * 60 * 60 * 1000,
          );
          if (!access.canManage && new Date() > cancellationDeadline) {
            throw new ApiError(
              409,
              "CANCELLATION_WINDOW_CLOSED",
              "The cancellation window has closed",
            );
          }

          const cancellationSource = cancellationSourceFor(viewer, access.canManage);
          const actorRole = roleForCancellationSource(cancellationSource);
          const cancelledAt = new Date();
          const updated = await tx.booking.update({
            where: { id },
            data: {
              status: BookingStatus.CANCELLED,
              cancelledById: viewer.id,
              cancelledAt,
              cancellationReason: reason,
              cancellationSource,
              cancelledByNameSnapshot: viewer.name,
              cancelledByRoleSnapshot: actorRole,
              cancellationIdempotencyKey: idempotencyKey,
              cancellationRequestFingerprint: requestFingerprint,
              statusHistory: {
                create: {
                  fromStatus: BookingStatus.CONFIRMED,
                  toStatus: BookingStatus.CANCELLED,
                  actorUserId: viewer.id,
                  actorNameSnapshot: viewer.name,
                  actorRoleSnapshot: actorRole,
                  reason,
                  idempotencyKey,
                },
              },
            },
            include: { participants: true },
          });
          await createBookingNotifications(tx, {
            userIds: booking.participants.map((participant) => participant.userId),
            type: "BOOKING_CANCELLED",
            title: `${booking.projectTitleSnapshot} booking cancelled`,
            body: `${formatBookingWindow(
              booking.slotStartsAtSnapshot,
              booking.slotEndsAtSnapshot,
              booking.timeZoneSnapshot,
            )}. Reason: ${reason}`,
            href: `/bookings/${booking.id}`,
          });
          await tx.auditLog.create({
            data: {
              actorUserId: viewer.id,
              action: "booking.cancelled",
              entityType: "Booking",
              entityId: id,
              metadata: {
                reason,
                cancellationSource,
                cancelledAt: cancelledAt.toISOString(),
                from: BookingStatus.CONFIRMED,
                to: BookingStatus.CANCELLED,
              },
              requestId: context.requestId,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
          });
          return { booking: updated, replayed: false as const };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
      if (!result.replayed) await publishAvailability(result.booking, "BOOKING_CANCELLED");
      return {
        booking: bookingDto(result.booking, bookingAccess(viewer)),
        replayed: result.replayed,
      };
    } catch (error) {
      if (isUniqueConflict(error)) {
        const replay = await prisma.booking.findFirst({
          where: { cancelledById: viewer.id, cancellationIdempotencyKey: idempotencyKey },
          include: { participants: true },
        });
        if (replay?.id === id) {
          return cancellationReplay(replay, requestFingerprint, idempotencyKey, viewer);
        }
        throw new ApiError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This cancellation key has already been used",
        );
      }
      if (isSerializationConflict(error)) {
        const replay = await findCancellationReplay(viewer.id, idempotencyKey);
        if (replay?.id === id) {
          return cancellationReplay(replay, requestFingerprint, idempotencyKey, viewer);
        }
        if (attempt < maxTransactionAttempts) {
          await waitForSerializationRetry(attempt);
          continue;
        }
        throw new ApiError(
          409,
          "TRANSACTION_CONFLICT",
          "The booking changed during cancellation. Refresh and try again.",
        );
      }
      throw error;
    }
  }
  throw new ApiError(409, "TRANSACTION_CONFLICT", "Refresh the booking and try again");
}

export async function updateStatus(
  id: string,
  status: BookingStatus,
  notes: string | null | undefined,
  viewer: Viewer,
  context: RequestContext = {},
) {
  if (status === BookingStatus.CANCELLED) {
    throw new ApiError(
      400,
      "CANCELLATION_ENDPOINT_REQUIRED",
      "Use the cancellation endpoint so actor, reason, and history are preserved",
    );
  }
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    CONFIRMED: [BookingStatus.ACTIVE, BookingStatus.NO_SHOW],
    ACTIVE: [BookingStatus.COMPLETED],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  const updated = await prisma.$transaction(
    async (tx) => {
      await lockBooking(tx, id);
      const existing = await tx.booking.findUnique({
        where: { id },
        include: { participants: true },
      });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Booking not found");
      if (!allowed[existing.status].includes(status)) {
        throw new ApiError(
          409,
          "INVALID_BOOKING_STATE",
          "This booking status transition is not allowed",
        );
      }
      const actorRole = primaryRole(viewer.roles);
      const booking = await tx.booking.update({
        where: { id },
        data: {
          status,
          notes,
          statusHistory: {
            create: {
              fromStatus: existing.status,
              toStatus: status,
              actorUserId: viewer.id,
              actorNameSnapshot: viewer.name,
              actorRoleSnapshot: actorRole,
              notes,
            },
          },
        },
        include: { participants: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: viewer.id,
          action: "booking.status_changed",
          entityType: "Booking",
          entityId: id,
          metadata: { from: existing.status, to: status, notes },
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return booking;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
  await publishAvailability(updated, "BOOKING_STATUS_CHANGED");
  return bookingDto(updated, bookingAccess(viewer));
}

function assertSlotInsideBookingWindow(
  slot: {
    startsAt: Date;
    localDate: Date;
    lab: { bookingHorizonDays: number; timeZone: string };
  },
  now: Date,
) {
  const today = localToday(slot.lab.timeZone, now);
  const horizon = addLocalDays(today, slot.lab.bookingHorizonDays);
  const slotDate = slot.localDate.toISOString().slice(0, 10);
  if (slot.startsAt <= now || slotDate < today || slotDate > horizon) {
    throw new ApiError(409, "SLOT_OUTSIDE_BOOKING_WINDOW", "This slot cannot be booked now");
  }
}

function isActiveStudent(user: { roles: UserRole[]; isActive: boolean; deletedAt: Date | null }) {
  return user.isActive && user.deletedAt === null && user.roles.includes(UserRole.STUDENT);
}

function bookingAccess(viewer: Viewer) {
  const canManage = hasPermission(viewer.roles, "booking.manage");
  return {
    viewerId: viewer.id,
    canManage,
    canCancelOwn: hasPermission(viewer.roles, "booking.cancel.own"),
    canReadParticipantPii: canManage || hasPermission(viewer.roles, "booking.read.operational"),
  };
}

function assertCanRead(
  booking: { createdById: string; participants: Array<{ userId: string }> },
  viewer: Viewer,
) {
  const canRead =
    booking.createdById === viewer.id ||
    booking.participants.some((participant) => participant.userId === viewer.id) ||
    hasPermission(viewer.roles, "booking.read.operational");
  if (!canRead) throw new ApiError(403, "FORBIDDEN", "You do not have permission for this booking");
}

function assertCanCancel(booking: { createdById: string }, viewer: Viewer, canManage: boolean) {
  const canCancelOwn =
    booking.createdById === viewer.id && hasPermission(viewer.roles, "booking.cancel.own");
  if (!canManage && !canCancelOwn) {
    throw new ApiError(403, "FORBIDDEN", "You cannot cancel this booking");
  }
}

function creationFingerprint(data: BookingInput) {
  return fingerprint({
    version: 1,
    labSlotId: data.labSlotId,
    projectId: data.projectId,
    participantIds: [...data.participantIds].sort(),
    notes: data.notes ?? null,
  });
}

function cancellationFingerprint(id: string, reason: string) {
  return fingerprint({ version: 1, bookingId: id, reason });
}

function fingerprint(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function findCreationReplay(userId: string, idempotencyKey: string) {
  return prisma.booking.findUnique({
    where: { createdById_idempotencyKey: { createdById: userId, idempotencyKey } },
    include: { participants: true },
  });
}

function assertCreationFingerprint(booking: BookingRecord, expectedFingerprint: string) {
  if (booking.creationRequestFingerprint !== expectedFingerprint) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This booking key was already used with different booking details",
    );
  }
}

function assertCancellationFingerprint(booking: BookingRecord, expectedFingerprint: string) {
  if (
    booking.cancellationRequestFingerprint &&
    booking.cancellationRequestFingerprint !== expectedFingerprint
  ) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This cancellation key was already used with a different reason",
    );
  }
}

function cancellationReplay(
  booking: BookingRecord,
  expectedFingerprint: string,
  idempotencyKey: string,
  viewer: Viewer,
) {
  assertCanCancel(booking, viewer, hasPermission(viewer.roles, "booking.manage"));
  if (
    booking.cancelledById !== viewer.id ||
    booking.cancellationIdempotencyKey !== idempotencyKey
  ) {
    throw new ApiError(409, "BOOKING_ALREADY_CANCELLED", "This booking has already been cancelled");
  }
  assertCancellationFingerprint(booking, expectedFingerprint);
  if (booking.status !== BookingStatus.CANCELLED) {
    throw new ApiError(409, "CANCELLATION_NOT_COMMITTED", "Cancellation was not completed");
  }
  return { booking: bookingDto(booking, bookingAccess(viewer)), replayed: true as const };
}

async function findCancellationReplay(userId: string, idempotencyKey: string) {
  return prisma.booking.findFirst({
    where: { cancelledById: userId, cancellationIdempotencyKey: idempotencyKey },
    include: { participants: true },
  });
}

async function recoverCreationConflict(
  error: unknown,
  viewer: Viewer,
  data: BookingInput,
  expectedFingerprint: string,
) {
  if (!isUniqueConflict(error) && !isSerializationConflict(error)) return null;
  const replay = await findCreationReplay(viewer.id, data.idempotencyKey);
  if (replay) {
    assertCreationFingerprint(replay, expectedFingerprint);
    return { booking: bookingDto(replay, bookingAccess(viewer)), replayed: true as const };
  }
  if (isUniqueConflict(error)) {
    const duplicate = await prisma.booking.findFirst({
      where: {
        projectId: data.projectId,
        labSlotId: data.labSlotId,
        status: { in: capacityStatuses },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        "PROJECT_SLOT_ALREADY_BOOKED",
        "This project already has a live booking for the selected slot",
      );
    }
  }
  return null;
}

async function createBookingNotifications(
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

async function publishAvailability(
  booking: { id: string; labId: string; labSlotId: string },
  type: string,
) {
  try {
    await redis.publish(
      `lab:${booking.labId}:availability`,
      JSON.stringify({ type, bookingId: booking.id, labSlotId: booking.labSlotId }),
    );
  } catch (error) {
    logger.warn(
      { err: error, bookingId: booking.id, labSlotId: booking.labSlotId },
      "Booking committed but the availability publication failed",
    );
  }
}

function cancellationSourceFor(viewer: Viewer, canManage: boolean): BookingCancellationSource {
  if (!canManage) return BookingCancellationSource.STUDENT;
  if (viewer.roles.includes(UserRole.SUPER_ADMIN)) return BookingCancellationSource.SUPER_ADMIN;
  if (viewer.roles.includes(UserRole.ADMIN)) return BookingCancellationSource.ADMIN;
  return BookingCancellationSource.LAB_ASSISTANT;
}

function roleForCancellationSource(source: BookingCancellationSource) {
  return UserRole[source];
}

function primaryRole(roles: UserRole[]) {
  const priority = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.LAB_ASSISTANT,
    UserRole.FACULTY_MENTOR,
    UserRole.STUDENT,
  ];
  return priority.find((role) => roles.includes(role)) ?? UserRole.STUDENT;
}

function formatBookingWindow(startsAt: Date, endsAt: Date, timeZone: string) {
  const start = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(startsAt);
  const end = new Intl.DateTimeFormat("en-IN", { timeZone, timeStyle: "short" }).format(endsAt);
  return `${start}–${end}`;
}

async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "projects" WHERE id = ${projectId}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "Project not found");
}

async function lockSlot(tx: Prisma.TransactionClient, labSlotId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "lab_slots" WHERE id = ${labSlotId}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "MakerSpace slot not found");
}

async function lockBooking(tx: Prisma.TransactionClient, bookingId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "bookings" WHERE id = ${bookingId}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "Booking not found");
}

function isSerializationConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  const sqlState = typeof error.meta?.code === "string" ? error.meta.code : null;
  return error.code === "P2010" && (sqlState === "40001" || sqlState === "40P01");
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function waitForSerializationRetry(attempt: number) {
  const ceiling = Math.min(maxSerializationBackoffMs, 10 * 2 ** attempt);
  const delayMs = Math.max(1, Math.floor(Math.random() * ceiling));
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
