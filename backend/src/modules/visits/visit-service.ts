import {
  AttendanceStatus,
  BookingStatus,
  Prisma,
  QuickVisitStatus,
  UserRole,
  VisitCloseReason,
  VisitSource,
} from "@prisma/client";
import { prisma } from "../../config/db.js";
import { hasPermission } from "../../config/permissions.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { publishOccupancy } from "./quick-visit-service.js";
import { visitDto } from "./visit-serializers.js";
import {
  earlyCheckInMinutes,
  fingerprint,
  isSerializationConflict,
  isUniqueConflict,
  lockBooking,
  lockQuickVisit,
  lockVisit,
  maxTransactionAttempts,
  minutesBetween,
  primaryRole,
  transactionOptions,
  violated,
  waitForSerializationRetry,
  type RequestContext,
  type Viewer,
} from "./visit-shared.js";

type VisitRecord = Prisma.VisitGetPayload<Record<string, never>>;

export type CheckInInput =
  | {
      source: "BOOKING";
      bookingId: string;
      userId: string;
      idempotencyKey: string;
      notes?: string | null;
    }
  | { source: "QUICK_VISIT"; quickVisitId: string; idempotencyKey: string; notes?: string | null };

export async function checkIn(viewer: Viewer, data: CheckInInput, context: RequestContext = {}) {
  const requestFingerprint = checkInFingerprint(data);
  const replay = await findCheckInReplay(viewer.id, data.idempotencyKey);
  if (replay) {
    assertCheckInFingerprint(replay, requestFingerprint);
    return { visit: await decorate(replay, viewer), replayed: true as const };
  }

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const visit = await prisma.$transaction(
        (tx) =>
          data.source === "BOOKING"
            ? checkInBookingParticipant(tx, viewer, data, requestFingerprint, context)
            : checkInQuickVisit(tx, viewer, data, requestFingerprint, context),
        transactionOptions,
      );
      await publishOccupancy(visit.labId, "VISIT_CHECKED_IN");
      return { visit: await decorate(visit, viewer), replayed: false as const };
    } catch (error) {
      const recovered = await recoverCheckInConflict(error, viewer, data, requestFingerprint);
      if (recovered) return recovered;
      if (isSerializationConflict(error) && attempt < maxTransactionAttempts) {
        await waitForSerializationRetry(attempt);
        continue;
      }
      throw error;
    }
  }
  throw new ApiError(409, "CHECK_IN_CONTENTION", "The front desk is busy — please try again");
}

async function checkInBookingParticipant(
  tx: Prisma.TransactionClient,
  viewer: Viewer,
  data: Extract<CheckInInput, { source: "BOOKING" }>,
  requestFingerprint: string,
  context: RequestContext,
) {
  await lockBooking(tx, data.bookingId);
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: data.bookingId },
    include: { participants: true, lab: true },
  });

  if (booking.status === BookingStatus.CANCELLED) {
    throw new ApiError(409, "BOOKING_CANCELLED", "This booking was cancelled");
  }
  if (booking.status === BookingStatus.COMPLETED) {
    throw new ApiError(409, "BOOKING_COMPLETED", "This booking is already closed");
  }
  if (booking.status === BookingStatus.NO_SHOW) {
    throw new ApiError(
      409,
      "BOOKING_RELEASED_AS_NO_SHOW",
      "This booking was released as a no-show and its capacity has been returned to the slot",
    );
  }

  const participant = booking.participants.find((entry) => entry.userId === data.userId);
  if (!participant) {
    throw new ApiError(404, "PARTICIPANT_NOT_ON_BOOKING", "This person is not on the booking");
  }

  const now = new Date();
  assertInsideCheckInWindow(booking.slotStartsAtSnapshot, booking.slotEndsAtSnapshot, now);

  const visit = await tx.visit.create({
    data: {
      labId: booking.labId,
      userId: participant.userId,
      bookingId: booking.id,
      projectId: booking.projectId,
      source: VisitSource.BOOKING,
      status: AttendanceStatus.CHECKED_IN,
      checkInIdempotencyKey: data.idempotencyKey,
      checkInRequestFingerprint: requestFingerprint,
      labNameSnapshot: booking.labNameSnapshot,
      timeZoneSnapshot: booking.timeZoneSnapshot,
      projectTitleSnapshot: booking.projectTitleSnapshot,
      userNameSnapshot: participant.nameSnapshot,
      userEmailSnapshot: participant.emailSnapshot,
      userPrnSnapshot: participant.prnSnapshot,
      expectedStartAt: booking.slotStartsAtSnapshot,
      expectedEndAt: booking.slotEndsAtSnapshot,
      lateByMinutes: minutesBetween(booking.slotStartsAtSnapshot, now),
      notes: data.notes ?? null,
      checkedInAt: now,
      checkedInById: viewer.id,
    },
  });

  await tx.bookingParticipant.update({
    where: { bookingId_userId: { bookingId: booking.id, userId: participant.userId } },
    data: { attendanceStatus: AttendanceStatus.CHECKED_IN },
  });

  // The first arrival flips the booking into ACTIVE so the console, the
  // student's own list, and capacity reporting all agree on one state.
  if (booking.status === BookingStatus.CONFIRMED) {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.ACTIVE,
        statusHistory: {
          create: {
            fromStatus: BookingStatus.CONFIRMED,
            toStatus: BookingStatus.ACTIVE,
            actorUserId: viewer.id,
            actorNameSnapshot: viewer.name,
            actorRoleSnapshot: primaryRole(viewer.roles),
            reason: "First participant checked in",
          },
        },
      },
    });
  }

  await tx.auditLog.create({
    data: {
      actorUserId: viewer.id,
      action: "visit.checked_in",
      entityType: "Visit",
      entityId: visit.id,
      metadata: {
        source: VisitSource.BOOKING,
        bookingId: booking.id,
        subjectUserId: participant.userId,
        lateByMinutes: visit.lateByMinutes,
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
  return visit;
}

async function checkInQuickVisit(
  tx: Prisma.TransactionClient,
  viewer: Viewer,
  data: Extract<CheckInInput, { source: "QUICK_VISIT" }>,
  requestFingerprint: string,
  context: RequestContext,
) {
  await lockQuickVisit(tx, data.quickVisitId);
  const quickVisit = await tx.quickVisit.findUniqueOrThrow({ where: { id: data.quickVisitId } });

  if (quickVisit.status === QuickVisitStatus.REQUESTED) {
    throw new ApiError(
      409,
      "QUICK_VISIT_NOT_APPROVED",
      "Approve this Quick Visit request before admitting the visitor",
    );
  }
  if (quickVisit.status !== QuickVisitStatus.CONFIRMED) {
    throw new ApiError(
      409,
      "QUICK_VISIT_NOT_ADMISSIBLE",
      `This Quick Visit is ${quickVisit.status.toLowerCase()} and cannot be checked in`,
    );
  }

  const now = new Date();
  assertInsideCheckInWindow(quickVisit.slotStartsAtSnapshot, quickVisit.slotEndsAtSnapshot, now);

  const visit = await tx.visit.create({
    data: {
      labId: quickVisit.labId,
      userId: quickVisit.userId,
      quickVisitId: quickVisit.id,
      source: VisitSource.QUICK_VISIT,
      status: AttendanceStatus.CHECKED_IN,
      checkInIdempotencyKey: data.idempotencyKey,
      checkInRequestFingerprint: requestFingerprint,
      labNameSnapshot: quickVisit.labNameSnapshot,
      timeZoneSnapshot: quickVisit.timeZoneSnapshot,
      userNameSnapshot: quickVisit.userNameSnapshot,
      userEmailSnapshot: quickVisit.userEmailSnapshot,
      userPrnSnapshot: quickVisit.userPrnSnapshot,
      expectedStartAt: quickVisit.slotStartsAtSnapshot,
      expectedEndAt: quickVisit.slotEndsAtSnapshot,
      lateByMinutes: minutesBetween(quickVisit.slotStartsAtSnapshot, now),
      notes: data.notes ?? null,
      checkedInAt: now,
      checkedInById: viewer.id,
    },
  });

  await tx.quickVisit.update({
    where: { id: quickVisit.id },
    data: { status: QuickVisitStatus.ACTIVE },
  });

  await tx.auditLog.create({
    data: {
      actorUserId: viewer.id,
      action: "visit.checked_in",
      entityType: "Visit",
      entityId: visit.id,
      metadata: {
        source: VisitSource.QUICK_VISIT,
        quickVisitId: quickVisit.id,
        subjectUserId: quickVisit.userId,
        lateByMinutes: visit.lateByMinutes,
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
  return visit;
}

export async function checkOut(
  id: string,
  input: { idempotencyKey: string; notes?: string | null },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const requestFingerprint = checkOutFingerprint(id, input.notes ?? null);
  const replay = await prisma.visit.findFirst({
    where: { checkedOutById: viewer.id, checkOutIdempotencyKey: input.idempotencyKey },
  });
  if (replay) {
    if (
      replay.id !== id ||
      (replay.checkOutRequestFingerprint &&
        replay.checkOutRequestFingerprint !== requestFingerprint)
    ) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "This check-out key was already used for a different visit",
      );
    }
    return { visit: await decorate(replay, viewer), replayed: true as const };
  }

  const closed = await prisma.$transaction(async (tx) => {
    await lockVisit(tx, id);
    const visit = await tx.visit.findUniqueOrThrow({ where: { id } });
    if (visit.status === AttendanceStatus.CHECKED_OUT) {
      throw new ApiError(409, "VISIT_ALREADY_CLOSED", "This visit is already checked out");
    }

    const now = new Date();
    const updated = await tx.visit.update({
      where: { id },
      data: {
        status: AttendanceStatus.CHECKED_OUT,
        checkedOutAt: now,
        checkedOutById: viewer.id,
        checkOutIdempotencyKey: input.idempotencyKey,
        checkOutRequestFingerprint: requestFingerprint,
        closeReason: VisitCloseReason.CHECKED_OUT,
        overstayByMinutes: minutesBetween(visit.expectedEndAt, now),
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    if (visit.bookingId) {
      await tx.bookingParticipant.update({
        where: { bookingId_userId: { bookingId: visit.bookingId, userId: visit.userId } },
        data: { attendanceStatus: AttendanceStatus.CHECKED_OUT },
      });
      await settleBookingIfFinished(tx, visit.bookingId, viewer);
    }
    if (visit.quickVisitId) {
      await tx.quickVisit.update({
        where: { id: visit.quickVisitId },
        data: { status: QuickVisitStatus.COMPLETED },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "visit.checked_out",
        entityType: "Visit",
        entityId: id,
        metadata: {
          subjectUserId: visit.userId,
          overstayByMinutes: updated.overstayByMinutes,
          durationMinutes: minutesBetween(visit.checkedInAt, now),
        },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return updated;
  }, transactionOptions);

  await publishOccupancy(closed.labId, "VISIT_CHECKED_OUT");
  return { visit: await decorate(closed, viewer), replayed: false as const };
}

/**
 * Closes a booking once every participant has reached a terminal attendance
 * state. Called inside the check-out transaction and by the reconciler, so a
 * booking never lingers ACTIVE after the last person leaves.
 */
export async function settleBookingIfFinished(
  tx: Prisma.TransactionClient,
  bookingId: string,
  viewer: Viewer | null,
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { participants: { select: { attendanceStatus: true } } },
  });
  if (!booking || booking.status !== BookingStatus.ACTIVE) return;

  const unresolved = booking.participants.filter(
    (participant) =>
      participant.attendanceStatus !== AttendanceStatus.CHECKED_OUT &&
      participant.attendanceStatus !== AttendanceStatus.NO_SHOW,
  );
  if (unresolved.length) return;

  await tx.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.COMPLETED,
      statusHistory: {
        create: {
          fromStatus: BookingStatus.ACTIVE,
          toStatus: BookingStatus.COMPLETED,
          actorUserId: viewer?.id ?? null,
          actorNameSnapshot: viewer?.name ?? "MakerSpace automation",
          actorRoleSnapshot: viewer ? primaryRole(viewer.roles) : UserRole.LAB_ASSISTANT,
          reason: "All participants accounted for",
        },
      },
    },
  });
}

export async function list(query: Record<string, unknown>, viewer: Viewer) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const operational = hasPermission(viewer.roles, "visit.read.operational");
  const where: Prisma.VisitWhereInput = {
    AND: [
      operational ? (query.userId ? { userId: String(query.userId) } : {}) : { userId: viewer.id },
      query.labId ? { labId: String(query.labId) } : {},
      query.bookingId ? { bookingId: String(query.bookingId) } : {},
      query.projectId ? { projectId: String(query.projectId) } : {},
      query.status ? { status: query.status as AttendanceStatus } : {},
      query.source ? { source: query.source as VisitSource } : {},
      query.from || query.to
        ? {
            checkedInAt: {
              ...(query.from ? { gte: new Date(String(query.from)) } : {}),
              ...(query.to ? { lte: new Date(String(query.to)) } : {}),
            },
          }
        : {},
    ],
  };
  const [total, rows] = await prisma.$transaction([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      orderBy: [{ checkedInAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const policies = await policyMap(rows.map((row) => row.labId));
  return {
    data: rows.map((row) => visitDto(row, access(viewer), policies.get(row.labId))),
    meta: meta(page, limit, total),
  };
}

export async function get(id: string, viewer: Viewer) {
  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit) throw new ApiError(404, "NOT_FOUND", "Visit not found");
  if (visit.userId !== viewer.id && !hasPermission(viewer.roles, "visit.read.operational")) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this visit");
  }
  return decorate(visit, viewer);
}

// ─── internals ───────────────────────────────────────────────────────────────

function assertInsideCheckInWindow(startsAt: Date, endsAt: Date, now: Date) {
  const opensAt = new Date(startsAt.getTime() - earlyCheckInMinutes * 60_000);
  if (now < opensAt) {
    throw new ApiError(
      409,
      "CHECK_IN_NOT_OPEN_YET",
      `Check-in opens ${earlyCheckInMinutes} minutes before the slot starts`,
    );
  }
  if (now >= endsAt) {
    throw new ApiError(409, "SLOT_ALREADY_ENDED", "This slot has already ended");
  }
}

function access(viewer: Viewer) {
  return {
    viewerId: viewer.id,
    canManage: hasPermission(viewer.roles, "visit.manage"),
    canReadPii: hasPermission(viewer.roles, "visit.read.operational"),
  };
}

async function policyMap(labIds: string[]) {
  const unique = [...new Set(labIds)];
  if (!unique.length)
    return new Map<string, { lateArrivalGraceMinutes: number; overstayGraceMinutes: number }>();
  const labs = await prisma.lab.findMany({
    where: { id: { in: unique } },
    select: { id: true, lateArrivalGraceMinutes: true, overstayGraceMinutes: true },
  });
  return new Map(labs.map((lab) => [lab.id, lab]));
}

async function decorate(visit: VisitRecord, viewer: Viewer) {
  const policies = await policyMap([visit.labId]);
  return visitDto(visit, access(viewer), policies.get(visit.labId));
}

function checkInFingerprint(data: CheckInInput) {
  return fingerprint(
    data.source === "BOOKING"
      ? { version: 1, source: data.source, bookingId: data.bookingId, userId: data.userId }
      : { version: 1, source: data.source, quickVisitId: data.quickVisitId },
  );
}

function checkOutFingerprint(visitId: string, notes: string | null) {
  return fingerprint({ version: 1, visitId, notes });
}

function findCheckInReplay(actorId: string, idempotencyKey: string) {
  return prisma.visit.findUnique({
    where: {
      checkedInById_checkInIdempotencyKey: {
        checkedInById: actorId,
        checkInIdempotencyKey: idempotencyKey,
      },
    },
  });
}

function assertCheckInFingerprint(visit: VisitRecord, expected: string) {
  if (visit.checkInRequestFingerprint !== expected) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This check-in key was already used for a different person",
    );
  }
}

async function recoverCheckInConflict(
  error: unknown,
  viewer: Viewer,
  data: CheckInInput,
  expected: string,
) {
  if (!isUniqueConflict(error) && !isSerializationConflict(error)) return null;
  const replay = await findCheckInReplay(viewer.id, data.idempotencyKey);
  if (replay) {
    assertCheckInFingerprint(replay, expected);
    return { visit: await decorate(replay, viewer), replayed: true as const };
  }
  if (!isUniqueConflict(error)) return null;

  // `visits_open_per_user_uniq` — a person can only be inside one place at once.
  if (violated(error, "user_id")) {
    throw new ApiError(
      409,
      "VISITOR_ALREADY_INSIDE",
      "This person is already checked in. Check them out before starting a new visit.",
    );
  }
  // `visits_booking_id_user_id_key` / `visits_quick_visit_id_key` — attendance
  // for this booking seat or Quick Visit already exists.
  if (violated(error, "booking_id", "user_id") || violated(error, "quick_visit_id")) {
    throw new ApiError(
      409,
      "ALREADY_CHECKED_IN",
      "Attendance for this person has already been recorded",
    );
  }
  return null;
}
