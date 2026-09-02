import {
  AttendanceStatus,
  BookingStatus,
  Prisma,
  QuickVisitStatus,
  VisitSource,
} from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { localDateDbValue, localToday } from "../labs/lab-time.js";
import { liveQuickVisitStatuses } from "./quick-visit-service.js";
import type { Viewer } from "./visit-shared.js";

const liveBookingStatuses: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.ACTIVE];
const liveQuickVisitStatusSet: QuickVisitStatus[] = [...liveQuickVisitStatuses];

type RosterBooking = Prisma.BookingGetPayload<{ include: { participants: true } }>;
type RosterQuickVisit = Prisma.QuickVisitGetPayload<Record<string, never>>;

/**
 * Live headcount for a MakerSpace.
 *
 * Deliberately uncached: occupancy drives physical safety decisions, so a stale
 * number is worse than a marginally more expensive read. The partial index
 * `visits_open_per_user_uniq` plus `visits(lab_id, status, checked_in_at)` keep
 * this to an index scan over a set bounded by room capacity.
 */
export async function occupancy(labId: string, _viewer: Viewer) {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: {
      id: true,
      name: true,
      timeZone: true,
      bookingCapacity: true,
      quickVisitCapacity: true,
      overstayGraceMinutes: true,
      lateArrivalGraceMinutes: true,
    },
  });
  if (!lab) throw new ApiError(404, "NOT_FOUND", "MakerSpace not found");

  const now = new Date();
  const open = await prisma.visit.findMany({
    where: { labId, status: AttendanceStatus.CHECKED_IN },
    orderBy: { checkedInAt: "asc" },
    select: {
      id: true,
      userId: true,
      source: true,
      bookingId: true,
      quickVisitId: true,
      projectId: true,
      projectTitleSnapshot: true,
      userNameSnapshot: true,
      userEmailSnapshot: true,
      userPrnSnapshot: true,
      checkedInAt: true,
      expectedStartAt: true,
      expectedEndAt: true,
      lateByMinutes: true,
    },
  });

  const inside = open.map((visit) => {
    const overstayByMinutes = Math.max(
      0,
      Math.floor((now.getTime() - visit.expectedEndAt.getTime()) / 60_000),
    );
    return {
      visitId: visit.id,
      userId: visit.userId,
      name: visit.userNameSnapshot,
      email: visit.userEmailSnapshot,
      prn: visit.userPrnSnapshot,
      source: visit.source,
      bookingId: visit.bookingId,
      quickVisitId: visit.quickVisitId,
      projectId: visit.projectId,
      projectTitle: visit.projectTitleSnapshot,
      checkedInAt: visit.checkedInAt.toISOString(),
      expectedEndAt: visit.expectedEndAt.toISOString(),
      minutesInside: Math.max(
        0,
        Math.floor((now.getTime() - visit.checkedInAt.getTime()) / 60_000),
      ),
      lateByMinutes: visit.lateByMinutes,
      isLateArrival: visit.lateByMinutes > lab.lateArrivalGraceMinutes,
      overstayByMinutes,
      isOverstay: overstayByMinutes > lab.overstayGraceMinutes,
    };
  });

  return {
    lab: { id: lab.id, name: lab.name, timeZone: lab.timeZone },
    observedAt: now.toISOString(),
    current: inside.length,
    fromBookings: inside.filter((entry) => entry.source === VisitSource.BOOKING).length,
    fromQuickVisits: inside.filter((entry) => entry.source === VisitSource.QUICK_VISIT).length,
    overstaying: inside.filter((entry) => entry.isOverstay).length,
    capacity: lab.bookingCapacity + lab.quickVisitCapacity,
    inside,
  };
}

/**
 * The Lab Assistant console for one operating day.
 *
 * Everything the console renders is produced by a fixed set of five indexed
 * reads issued as a single batch, then joined in memory. The cost does not grow
 * with the number of bookings, participants or visitors on screen — there is no
 * per-row follow-up query anywhere in this function.
 */
export async function roster(labId: string, date: string | undefined, viewer: Viewer) {
  const lab = await prisma.lab.findUnique({ where: { id: labId } });
  if (!lab) throw new ApiError(404, "NOT_FOUND", "MakerSpace not found");
  const localDate = date ?? localToday(lab.timeZone);

  const slots = await prisma.labSlot.findMany({
    where: { labId, localDate: localDateDbValue(localDate) },
    orderBy: { startsAt: "asc" },
  });
  const slotIds = slots.map((slot) => slot.id);

  const [bookings, quickVisits, liveOccupancy] = await Promise.all([
    slotIds.length
      ? prisma.booking.findMany({
          where: { labSlotId: { in: slotIds } },
          include: { participants: true },
          orderBy: [{ slotStartsAtSnapshot: "asc" }, { id: "asc" }],
        })
      : Promise.resolve<RosterBooking[]>([]),
    slotIds.length
      ? prisma.quickVisit.findMany({
          where: { labSlotId: { in: slotIds } },
          orderBy: [{ slotStartsAtSnapshot: "asc" }, { id: "asc" }],
        })
      : Promise.resolve<RosterQuickVisit[]>([]),
    occupancy(labId, viewer),
  ]);

  const bookingIds = bookings.map((booking) => booking.id);
  const quickVisitIds = quickVisits.map((quickVisit) => quickVisit.id);
  const visits =
    bookingIds.length || quickVisitIds.length
      ? await prisma.visit.findMany({
          where: {
            OR: [
              ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
              ...(quickVisitIds.length ? [{ quickVisitId: { in: quickVisitIds } }] : []),
            ],
          },
        })
      : [];

  // Index attendance once so the assembly below is pure O(n) map lookups.
  const visitByBookingUser = new Map<string, (typeof visits)[number]>();
  const visitByQuickVisit = new Map<string, (typeof visits)[number]>();
  for (const visit of visits) {
    if (visit.bookingId) visitByBookingUser.set(`${visit.bookingId}:${visit.userId}`, visit);
    if (visit.quickVisitId) visitByQuickVisit.set(visit.quickVisitId, visit);
  }

  const bookingsBySlot = new Map<string, RosterBooking[]>();
  for (const booking of bookings) {
    const bucket = bookingsBySlot.get(booking.labSlotId);
    if (bucket) bucket.push(booking);
    else bookingsBySlot.set(booking.labSlotId, [booking]);
  }
  const quickVisitsBySlot = new Map<string, RosterQuickVisit[]>();
  for (const quickVisit of quickVisits) {
    const bucket = quickVisitsBySlot.get(quickVisit.labSlotId);
    if (bucket) bucket.push(quickVisit);
    else quickVisitsBySlot.set(quickVisit.labSlotId, [quickVisit]);
  }

  const now = new Date();
  const slotViews = slots.map((slot) => {
    const slotBookings = bookingsBySlot.get(slot.id) ?? [];
    const slotQuickVisits = quickVisitsBySlot.get(slot.id) ?? [];
    const liveBookings = slotBookings.filter((booking) =>
      liveBookingStatuses.includes(booking.status),
    );
    const liveQuickVisits = slotQuickVisits.filter((quickVisit) =>
      liveQuickVisitStatusSet.includes(quickVisit.status),
    );
    return {
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      status: slot.status,
      isCurrent: slot.startsAt <= now && now < slot.endsAt,
      bookingCapacity: slot.bookingCapacity,
      quickVisitCapacity: slot.quickVisitCapacity,
      seatsTaken: liveBookings.reduce((sum, booking) => sum + booking.attendeeCount, 0),
      quickVisitSeatsTaken: liveQuickVisits.length,
      bookings: slotBookings.map((booking) => {
        const participants = booking.participants.map((participant) => {
          const visit = visitByBookingUser.get(`${booking.id}:${participant.userId}`);
          return {
            userId: participant.userId,
            name: participant.nameSnapshot,
            email: participant.emailSnapshot,
            prn: participant.prnSnapshot,
            role: participant.projectRoleSnapshot,
            attendanceStatus: participant.attendanceStatus,
            visitId: visit?.id ?? null,
            checkedInAt: visit?.checkedInAt.toISOString() ?? null,
            checkedOutAt: visit?.checkedOutAt?.toISOString() ?? null,
            lateByMinutes: visit?.lateByMinutes ?? 0,
            isLateArrival: (visit?.lateByMinutes ?? 0) > lab.lateArrivalGraceMinutes,
            canCheckIn:
              liveBookingStatuses.includes(booking.status) &&
              participant.attendanceStatus === AttendanceStatus.EXPECTED,
            canCheckOut: visit?.status === AttendanceStatus.CHECKED_IN,
          };
        });
        return {
          id: booking.id,
          projectId: booking.projectId,
          projectTitle: booking.projectTitleSnapshot,
          status: booking.status,
          attendeeCount: booking.attendeeCount,
          notes: booking.notes,
          presentCount: participants.filter(
            (participant) => participant.attendanceStatus === AttendanceStatus.CHECKED_IN,
          ).length,
          participants,
        };
      }),
      quickVisits: slotQuickVisits.map((quickVisit) => {
        const visit = visitByQuickVisit.get(quickVisit.id);
        return {
          id: quickVisit.id,
          userId: quickVisit.userId,
          name: quickVisit.userNameSnapshot,
          email: quickVisit.userEmailSnapshot,
          prn: quickVisit.userPrnSnapshot,
          purpose: quickVisit.purpose,
          status: quickVisit.status,
          visitId: visit?.id ?? null,
          checkedInAt: visit?.checkedInAt.toISOString() ?? null,
          checkedOutAt: visit?.checkedOutAt?.toISOString() ?? null,
          canDecide: quickVisit.status === QuickVisitStatus.REQUESTED,
          canCheckIn: quickVisit.status === QuickVisitStatus.CONFIRMED,
          canCheckOut: visit?.status === AttendanceStatus.CHECKED_IN,
        };
      }),
    };
  });

  return {
    lab: {
      id: lab.id,
      name: lab.name,
      timeZone: lab.timeZone,
      quickVisitsEnabled: lab.quickVisitsEnabled,
      quickVisitsRequireApproval: lab.quickVisitsRequireApproval,
      lateArrivalGraceMinutes: lab.lateArrivalGraceMinutes,
      overstayGraceMinutes: lab.overstayGraceMinutes,
      noShowReleaseMinutes: lab.noShowReleaseMinutes,
    },
    date: localDate,
    observedAt: now.toISOString(),
    occupancy: {
      current: liveOccupancy.current,
      fromBookings: liveOccupancy.fromBookings,
      fromQuickVisits: liveOccupancy.fromQuickVisits,
      overstaying: liveOccupancy.overstaying,
      capacity: liveOccupancy.capacity,
      inside: liveOccupancy.inside,
    },
    pendingQuickVisitRequests: quickVisits.filter(
      (quickVisit) => quickVisit.status === QuickVisitStatus.REQUESTED,
    ).length,
    slots: slotViews,
  };
}
