import {
  AttendanceStatus,
  BookingStatus,
  EquipmentStatus,
  ProjectStatus,
  QuickVisitStatus,
} from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import {
  addLocalDays,
  localDateDbValue,
  localToday,
  zonedLocalMinuteToUtc,
} from "../labs/lab-time.js";
import type { Viewer } from "../visits/visit-shared.js";

/**
 * Operational dashboard.
 *
 * One request, one batch. Every figure below comes from a `groupBy` or `count`
 * that is answered by an existing index, issued together in a single
 * `$transaction` so the whole dashboard costs one round trip rather than a
 * dozen. Nothing here scans an unbounded table.
 */
export async function dashboard(labId: string, _viewer: Viewer) {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: {
      id: true,
      name: true,
      timeZone: true,
      bookingCapacity: true,
      quickVisitCapacity: true,
    },
  });
  if (!lab) throw new ApiError(404, "NOT_FOUND", "MakerSpace not found");

  const now = new Date();
  const today = localToday(lab.timeZone, now);
  const weekAgo = addLocalDays(today, -6);

  // Bookings and Quick Visits store a full UTC instant, so a "today" window has
  // to be the UTC instants that bracket the lab's local day — not UTC midnight.
  // For Asia/Kolkata those differ by 5h30m, which is enough to drop a whole
  // evening of bookings out of the daily figures.
  const dayStartUtc = zonedLocalMinuteToUtc(today, 0, lab.timeZone);
  const dayEndUtc = zonedLocalMinuteToUtc(addLocalDays(today, 1), 0, lab.timeZone);
  const weekStartUtc = zonedLocalMinuteToUtc(weekAgo, 0, lab.timeZone);
  // `lab_slots.local_date` is a DATE column already expressed in lab-local
  // terms, so it is compared against the calendar date rather than an instant.
  const todayLocalDate = localDateDbValue(today);

  const [
    bookingsToday,
    bookingsThisWeek,
    projectsByStatus,
    equipmentByStatus,
    quickVisitsToday,
    openVisits,
    pendingQuickVisits,
    slotsToday,
  ] = await prisma.$transaction([
    prisma.booking.groupBy({
      by: ["status"],
      where: { labId, slotStartsAtSnapshot: { gte: dayStartUtc, lt: dayEndUtc } },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { labId, slotStartsAtSnapshot: { gte: weekStartUtc, lt: dayEndUtc } },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.project.groupBy({
      by: ["status"],
      where: { labId, deletedAt: null },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.equipment.groupBy({
      by: ["status"],
      where: { labId, deletedAt: null },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.quickVisit.groupBy({
      by: ["status"],
      where: { labId, slotStartsAtSnapshot: { gte: dayStartUtc, lt: dayEndUtc } },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.visit.count({ where: { labId, status: AttendanceStatus.CHECKED_IN } }),
    prisma.quickVisit.count({
      where: { labId, status: QuickVisitStatus.REQUESTED, slotEndsAtSnapshot: { gte: now } },
    }),
    prisma.labSlot.count({ where: { labId, localDate: todayLocalDate } }),
  ]);

  const bookingToday = tally(bookingsToday, BookingStatus);
  const bookingWeek = tally(bookingsThisWeek, BookingStatus);
  const weekNoShows = bookingWeek.NO_SHOW ?? 0;
  const attended = (bookingWeek.COMPLETED ?? 0) + (bookingWeek.ACTIVE ?? 0);
  const decided = attended + weekNoShows;

  return {
    lab,
    observedAt: now.toISOString(),
    date: today,
    live: {
      occupancy: openVisits,
      capacity: lab.bookingCapacity + lab.quickVisitCapacity,
      pendingQuickVisitRequests: pendingQuickVisits,
      slotsToday,
    },
    today: {
      bookings: bookingToday,
      bookingsTotal: sum(bookingToday),
      quickVisits: tally(quickVisitsToday, QuickVisitStatus),
    },
    lastSevenDays: {
      from: weekAgo,
      to: today,
      bookings: bookingWeek,
      bookingsTotal: sum(bookingWeek),
      // Share of decided bookings where nobody turned up. `null` rather than 0
      // when there is nothing to divide by — an empty week is not a perfect week.
      noShowRate: decided ? Number((weekNoShows / decided).toFixed(4)) : null,
    },
    projects: tally(projectsByStatus, ProjectStatus),
    equipment: tally(equipmentByStatus, EquipmentStatus),
  };
}

/**
 * Expands a sparse `groupBy` result into a dense record keyed by every enum
 * member, so the UI never has to guard for a status that simply had no rows.
 *
 * Prisma types `_count` loosely inside a `$transaction` batch, so the count is
 * read defensively rather than asserted.
 */
type GroupedRow = { status: string; _count?: unknown };

function tally<T extends Record<string, string>>(
  rows: readonly GroupedRow[],
  enumeration: T,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of Object.values(enumeration)) result[key] = 0;
  for (const row of rows) {
    if (!(row.status in result)) continue;
    result[row.status] = countOf(row._count);
  }
  return result;
}

function countOf(value: unknown) {
  if (typeof value === "object" && value !== null && "_all" in value) {
    const all = (value as { _all?: unknown })._all;
    if (typeof all === "number") return all;
  }
  return 0;
}

function sum(record: Record<string, number>) {
  return Object.values(record).reduce((total, value) => total + value, 0);
}
