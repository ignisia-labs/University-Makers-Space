import crypto from "node:crypto";
import {
  AttendanceStatus,
  BookingStatus,
  DeliveryStatus,
  NotificationChannel,
  Prisma,
  QuickVisitStatus,
  UserRole,
  VisitCloseReason,
} from "@prisma/client";
import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { redis } from "../config/redis.js";

/**
 * Attendance reconciler.
 *
 * Attendance has real-world state that no HTTP request will ever report: people
 * who never arrive, and people who never check out. Left alone, both corrupt
 * capacity accounting — a no-show holds a seat forever, and an open visit keeps
 * a booking ACTIVE for eternity. This job closes those gaps.
 *
 * Design constraints it satisfies:
 *  - Safe on every app instance simultaneously. A Redis lease means exactly one
 *    instance does the work per tick; the others return immediately.
 *  - Bounded. Every sweep takes a fixed page size and stops after a fixed
 *    number of pages, so one bad day cannot turn a tick into an outage.
 *  - Idempotent. Every mutation re-checks its precondition inside a row lock,
 *    so a duplicate or interrupted run cannot double-apply.
 */

const LOCK_KEY = "ums:jobs:attendance-reconciler";
const LOCK_TTL_MS = 55_000;
const TICK_INTERVAL_MS = 60_000;
const PAGE_SIZE = 200;
const MAX_PAGES = 25;

const releaseIfOwnedScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export type ReconcileSummary = {
  bookingsMarkedNoShow: number;
  participantsMarkedNoShow: number;
  visitsAutoClosed: number;
  quickVisitsMarkedNoShow: number;
  bookingsCompleted: number;
};

const emptySummary = (): ReconcileSummary => ({
  bookingsMarkedNoShow: 0,
  participantsMarkedNoShow: 0,
  visitsAutoClosed: 0,
  quickVisitsMarkedNoShow: 0,
  bookingsCompleted: 0,
});

/** Runs one full reconciliation pass. Exported so tests can drive it directly. */
export async function reconcileAttendance(now = new Date()): Promise<ReconcileSummary> {
  const summary = emptySummary();
  await releaseNoShowBookings(now, summary);
  await autoCloseElapsedVisits(now, summary);
  await closeOutElapsedBookings(now, summary);
  await expireElapsedQuickVisits(now, summary);
  return summary;
}

/**
 * Bookings whose slot started, whose no-show grace has elapsed, and where
 * nobody ever checked in. Their capacity goes back to the slot.
 */
async function releaseNoShowBookings(now: Date, summary: ReconcileSummary) {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const candidates = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT b.id
      FROM "bookings" b
      JOIN "labs" l ON l.id = b.lab_id
      WHERE b.status = 'CONFIRMED'
        AND b.slot_starts_at_snapshot + (l.no_show_release_minutes * INTERVAL '1 minute') <= ${now}
        AND NOT EXISTS (SELECT 1 FROM "visits" v WHERE v.booking_id = b.id)
      ORDER BY b.slot_starts_at_snapshot ASC
      LIMIT ${PAGE_SIZE}
    `);
    if (!candidates.length) return;

    for (const candidate of candidates) {
      try {
        const changed = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "bookings" WHERE id = ${candidate.id}::uuid FOR UPDATE
          `);
          if (!locked.length) return false;

          const booking = await tx.booking.findUniqueOrThrow({
            where: { id: candidate.id },
            include: { participants: { select: { userId: true } } },
          });
          // Someone may have checked in between the scan and this lock.
          if (booking.status !== BookingStatus.CONFIRMED) return false;
          const attended = await tx.visit.count({ where: { bookingId: booking.id } });
          if (attended > 0) return false;

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.NO_SHOW,
              statusHistory: {
                create: {
                  fromStatus: BookingStatus.CONFIRMED,
                  toStatus: BookingStatus.NO_SHOW,
                  actorNameSnapshot: "MakerSpace automation",
                  actorRoleSnapshot: UserRole.LAB_ASSISTANT,
                  reason: "No attendance recorded within the no-show window",
                },
              },
            },
          });
          await tx.bookingParticipant.updateMany({
            where: { bookingId: booking.id, attendanceStatus: AttendanceStatus.EXPECTED },
            data: { attendanceStatus: AttendanceStatus.NO_SHOW },
          });
          summary.participantsMarkedNoShow += booking.participants.length;

          await notify(tx, {
            userIds: [booking.createdById, ...booking.participants.map((p) => p.userId)],
            type: "BOOKING_NO_SHOW",
            title: `Marked as a no-show — ${booking.projectTitleSnapshot}`,
            body: `Nobody checked in for your ${booking.labNameSnapshot} slot, so it was released for other teams.`,
            href: `/bookings/${booking.id}`,
          });
          await tx.auditLog.create({
            data: {
              action: "booking.auto_no_show",
              entityType: "Booking",
              entityId: booking.id,
              metadata: { releasedAt: now.toISOString() },
            },
          });
          return true;
        }, transactionOptions);
        if (changed) summary.bookingsMarkedNoShow += 1;
      } catch (error) {
        logger.warn({ err: error, bookingId: candidate.id }, "No-show release failed");
      }
    }
    if (candidates.length < PAGE_SIZE) return;
  }
}

/** Visits still open past their slot end plus the lab's overstay grace. */
async function autoCloseElapsedVisits(now: Date, summary: ReconcileSummary) {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const candidates = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT v.id
      FROM "visits" v
      JOIN "labs" l ON l.id = v.lab_id
      WHERE v.status = 'CHECKED_IN'
        AND v.expected_end_at + (l.overstay_grace_minutes * INTERVAL '1 minute') <= ${now}
      ORDER BY v.expected_end_at ASC
      LIMIT ${PAGE_SIZE}
    `);
    if (!candidates.length) return;

    for (const candidate of candidates) {
      try {
        const changed = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "visits" WHERE id = ${candidate.id}::uuid FOR UPDATE
          `);
          if (!locked.length) return false;
          const visit = await tx.visit.findUniqueOrThrow({ where: { id: candidate.id } });
          if (visit.status !== AttendanceStatus.CHECKED_IN) return false;

          await tx.visit.update({
            where: { id: visit.id },
            data: {
              status: AttendanceStatus.CHECKED_OUT,
              checkedOutAt: now,
              closeReason: VisitCloseReason.AUTO_CLOSED_AT_SLOT_END,
              overstayByMinutes: Math.max(
                0,
                Math.floor((now.getTime() - visit.expectedEndAt.getTime()) / 60_000),
              ),
            },
          });
          if (visit.bookingId) {
            await tx.bookingParticipant.update({
              where: {
                bookingId_userId: { bookingId: visit.bookingId, userId: visit.userId },
              },
              data: { attendanceStatus: AttendanceStatus.CHECKED_OUT },
            });
          }
          if (visit.quickVisitId) {
            await tx.quickVisit.update({
              where: { id: visit.quickVisitId },
              data: { status: QuickVisitStatus.COMPLETED },
            });
          }
          await tx.auditLog.create({
            data: {
              action: "visit.auto_closed",
              entityType: "Visit",
              entityId: visit.id,
              metadata: { subjectUserId: visit.userId, closedAt: now.toISOString() },
            },
          });
          return true;
        }, transactionOptions);
        if (changed) summary.visitsAutoClosed += 1;
      } catch (error) {
        logger.warn({ err: error, visitId: candidate.id }, "Visit auto-close failed");
      }
    }
    if (candidates.length < PAGE_SIZE) return;
  }
}

/**
 * Bookings that ran (ACTIVE) whose slot has ended: anyone who never arrived
 * becomes a no-show, and the booking itself is completed.
 */
async function closeOutElapsedBookings(now: Date, summary: ReconcileSummary) {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const candidates = await prisma.booking.findMany({
      where: { status: BookingStatus.ACTIVE, slotEndsAtSnapshot: { lte: now } },
      orderBy: { slotEndsAtSnapshot: "asc" },
      take: PAGE_SIZE,
      select: { id: true },
    });
    if (!candidates.length) return;

    for (const candidate of candidates) {
      try {
        const changed = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "bookings" WHERE id = ${candidate.id}::uuid FOR UPDATE
          `);
          if (!locked.length) return false;
          const booking = await tx.booking.findUniqueOrThrow({
            where: { id: candidate.id },
            include: { participants: true },
          });
          if (booking.status !== BookingStatus.ACTIVE) return false;
          // An open visit means somebody is still inside; the auto-close sweep
          // owns that case and this booking will settle on the next tick.
          const open = await tx.visit.count({
            where: { bookingId: booking.id, status: AttendanceStatus.CHECKED_IN },
          });
          if (open > 0) return false;

          const absent = booking.participants.filter(
            (participant) => participant.attendanceStatus === AttendanceStatus.EXPECTED,
          );
          if (absent.length) {
            await tx.bookingParticipant.updateMany({
              where: { bookingId: booking.id, attendanceStatus: AttendanceStatus.EXPECTED },
              data: { attendanceStatus: AttendanceStatus.NO_SHOW },
            });
            summary.participantsMarkedNoShow += absent.length;
          }
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.COMPLETED,
              statusHistory: {
                create: {
                  fromStatus: BookingStatus.ACTIVE,
                  toStatus: BookingStatus.COMPLETED,
                  actorNameSnapshot: "MakerSpace automation",
                  actorRoleSnapshot: UserRole.LAB_ASSISTANT,
                  reason: "Slot ended and all attendance was resolved",
                },
              },
            },
          });
          await tx.auditLog.create({
            data: {
              action: "booking.auto_completed",
              entityType: "Booking",
              entityId: booking.id,
              metadata: { absentParticipants: absent.length },
            },
          });
          return true;
        }, transactionOptions);
        if (changed) summary.bookingsCompleted += 1;
      } catch (error) {
        logger.warn({ err: error, bookingId: candidate.id }, "Booking close-out failed");
      }
    }
    if (candidates.length < PAGE_SIZE) return;
  }
}

/** Quick Visits that were never admitted before their slot ended. */
async function expireElapsedQuickVisits(now: Date, summary: ReconcileSummary) {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const candidates = await prisma.quickVisit.findMany({
      where: {
        status: { in: [QuickVisitStatus.REQUESTED, QuickVisitStatus.CONFIRMED] },
        slotEndsAtSnapshot: { lte: now },
      },
      orderBy: { slotEndsAtSnapshot: "asc" },
      take: PAGE_SIZE,
      select: { id: true },
    });
    if (!candidates.length) return;

    for (const candidate of candidates) {
      try {
        const changed = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "quick_visits" WHERE id = ${candidate.id}::uuid FOR UPDATE
          `);
          if (!locked.length) return false;
          const quickVisit = await tx.quickVisit.findUniqueOrThrow({ where: { id: candidate.id } });
          if (
            quickVisit.status !== QuickVisitStatus.REQUESTED &&
            quickVisit.status !== QuickVisitStatus.CONFIRMED
          ) {
            return false;
          }
          await tx.quickVisit.update({
            where: { id: quickVisit.id },
            data: { status: QuickVisitStatus.NO_SHOW },
          });
          await tx.auditLog.create({
            data: {
              action: "quick_visit.auto_no_show",
              entityType: "QuickVisit",
              entityId: quickVisit.id,
              metadata: { from: quickVisit.status },
            },
          });
          return true;
        }, transactionOptions);
        if (changed) summary.quickVisitsMarkedNoShow += 1;
      } catch (error) {
        logger.warn({ err: error, quickVisitId: candidate.id }, "Quick Visit expiry failed");
      }
    }
    if (candidates.length < PAGE_SIZE) return;
  }
}

const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

async function notify(
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

/** Runs one tick if this instance wins the lease. Returns null when it does not. */
export async function runReconcilerTick(): Promise<ReconcileSummary | null> {
  const lease = crypto.randomUUID();
  const acquired = await redis.set(LOCK_KEY, lease, "PX", LOCK_TTL_MS, "NX");
  if (acquired !== "OK") return null;
  try {
    return await reconcileAttendance();
  } finally {
    try {
      await redis.eval(releaseIfOwnedScript, 1, LOCK_KEY, lease);
    } catch (error) {
      logger.warn({ err: error }, "Reconciler lease release failed; it will expire on its own");
    }
  }
}

export function startAttendanceReconciler() {
  const timer = setInterval(() => {
    void runReconcilerTick()
      .then((summary) => {
        if (
          summary &&
          (summary.bookingsMarkedNoShow ||
            summary.visitsAutoClosed ||
            summary.bookingsCompleted ||
            summary.quickVisitsMarkedNoShow)
        ) {
          logger.info({ summary }, "Attendance reconciled");
        }
      })
      .catch((error: unknown) => logger.error({ err: error }, "Attendance reconciler tick failed"));
  }, TICK_INTERVAL_MS);
  timer.unref();
  return timer;
}
