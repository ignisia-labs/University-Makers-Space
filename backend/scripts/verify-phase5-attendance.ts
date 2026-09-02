/**
 * Phase 5 attendance verification.
 *
 * Exercises the real services against a real PostgreSQL database — no mocks,
 * no stubs. Every assertion below is a property the MakerSpace depends on when
 * a queue of students is standing at the door.
 *
 * Run:
 *   RUN_PHASE5_DATABASE_TESTS=true npx tsx scripts/verify-phase5-attendance.ts
 */
import crypto from "node:crypto";
import {
  AttendanceStatus,
  BookingStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  QuickVisitStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import { reconcileAttendance } from "../src/jobs/attendance-reconciler.js";
import * as consoleService from "../src/modules/visits/console-service.js";
import * as quickVisits from "../src/modules/visits/quick-visit-service.js";
import * as visits from "../src/modules/visits/visit-service.js";

type Viewer = NonNullable<Express.Request["user"]>;

const enabled = process.env.RUN_PHASE5_DATABASE_TESTS === "true";
const burstRequests = bounded(process.env.PHASE5_BURST_REQUESTS, 30, 2, 200);
const burstCapacity = bounded(process.env.PHASE5_BURST_CAPACITY, 12, 1, 100);
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const prefix = `phase5-${runToken}`;
const startedAt = Date.now();

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

async function main() {
  if (!enabled) {
    throw new Error(
      "Refusing to mutate the configured database. Set RUN_PHASE5_DATABASE_TESTS=true explicitly.",
    );
  }
  assert(burstCapacity < burstRequests, "PHASE5_BURST_CAPACITY must be < PHASE5_BURST_REQUESTS");

  let assertions: Record<string, unknown> | undefined;
  let testFailure: unknown;
  let cleanupFailure: unknown;
  try {
    assertions = await runVerification();
  } catch (error) {
    testFailure = error;
  } finally {
    try {
      trace("cleanup …");
      await cleanup();
      trace("cleanup ✓");
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (testFailure || cleanupFailure) {
    throw new Error(
      [
        testFailure ? `verification: ${message(testFailure)}` : null,
        cleanupFailure ? `cleanup: ${message(cleanupFailure)}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  return { ok: true, assertions, cleanup: "verified", elapsedMs: Date.now() - startedAt };
}

const trace = (label: string) => {
  if (process.env.PHASE5_TRACE === "true") console.error(`[phase5] ${label}`);
};

async function step<T>(label: string, run: () => Promise<T>): Promise<T> {
  trace(`${label} …`);
  const value = await run();
  trace(`${label} ✓`);
  return value;
}

async function runVerification() {
  const fixture = await step("fixture", () => createFixture());
  return {
    quickVisitCapacityRace: await step("quickVisitCapacityRace", () =>
      verifyQuickVisitCapacityRace(fixture),
    ),
    quickVisitIdempotency: await step("quickVisitIdempotency", () =>
      verifyQuickVisitIdempotency(fixture),
    ),
    duplicateSlotRequest: await step("duplicateSlotRequest", () =>
      verifyDuplicateSlotRequestRejected(fixture),
    ),
    checkInIdempotency: await step("checkInIdempotency", () => verifyCheckInIdempotency(fixture)),
    doubleOccupancy: await step("doubleOccupancy", () => verifyDoubleOccupancyBlocked(fixture)),
    attendanceLifecycle: await step("attendanceLifecycle", () =>
      verifyAttendanceLifecycle(fixture),
    ),
    occupancyAccuracy: await step("occupancyAccuracy", () => verifyOccupancyAccuracy(fixture)),
    windowEnforcement: await step("windowEnforcement", () =>
      verifyCheckInWindowEnforcement(fixture),
    ),
    reconciler: await step("reconciler", () => verifyReconciler(fixture)),
    snapshots: await step("snapshots", () => verifySnapshotImmutability(fixture)),
    piiGating: await step("piiGating", () => verifyPiiGating(fixture)),
    console: await step("console", () => verifyConsoleShape(fixture)),
  };
}

// ─── fixtures ────────────────────────────────────────────────────────────────

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  const departmentId = crypto.randomUUID();
  const programmeId = crypto.randomUUID();
  const labId = crypto.randomUUID();

  await prisma.department.create({
    data: { id: departmentId, code: `P5D${runToken}`.toUpperCase(), name: `${prefix} department` },
  });
  await prisma.programme.create({
    data: {
      id: programmeId,
      departmentId,
      code: `P5P${runToken}`.toUpperCase(),
      name: `${prefix} programme`,
    },
  });
  await prisma.lab.create({
    data: {
      id: labId,
      code: `P5L${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      timeZone: "Asia/Kolkata",
      slotDurationMinutes: 60,
      bookingCapacity: 20,
      quickVisitCapacity: burstCapacity,
      quickVisitsEnabled: true,
      quickVisitsRequireApproval: false,
      bookingHorizonDays: 14,
      cancellationWindowHours: 0,
      lateArrivalGraceMinutes: 10,
      overstayGraceMinutes: 10,
      noShowReleaseMinutes: 20,
    },
  });

  const students = await createStudents(departmentId, programmeId, burstRequests + 12);
  const operator = await createOperator();

  return {
    labId,
    departmentId,
    programmeId,
    students,
    operator,
    // Far-future slots for the interactive tests.
    burstSlotId: await createSlot(labId, hoursFromNow(30), burstCapacity),
    idempotencySlotId: await createSlot(labId, hoursFromNow(32), burstCapacity),
    duplicateSlotId: await createSlot(labId, hoursFromNow(34), burstCapacity),
  };
}

async function createStudents(departmentId: string, programmeId: string, count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    email: `${prefix}-student-${index}@mitwpu.edu.in`,
    name: `${prefix} Student ${index}`,
    googleSubject: `${prefix}-sub-${index}`,
    roles: [UserRole.STUDENT],
    profileComplete: true,
    isActive: true,
  }));
  await prisma.user.createMany({ data: rows });
  await prisma.studentProfile.createMany({
    data: rows.map((row, index) => ({
      userId: row.id,
      prn: `${runToken.slice(0, 6)}${String(index).padStart(4, "0")}`.toUpperCase(),
      departmentId,
      programmeId,
      academicYear: 2,
    })),
  });
  return rows.map((row) => viewerFor(row.id, row.name, row.email, [UserRole.STUDENT]));
}

async function createOperator() {
  const id = crypto.randomUUID();
  const email = `${prefix}-operator@mitwpu.edu.in`;
  await prisma.user.create({
    data: {
      id,
      email,
      name: `${prefix} Lab Assistant`,
      googleSubject: `${prefix}-operator`,
      roles: [UserRole.LAB_ASSISTANT],
      profileComplete: true,
      isActive: true,
    },
  });
  return viewerFor(id, `${prefix} Lab Assistant`, email, [UserRole.LAB_ASSISTANT]);
}

function viewerFor(id: string, name: string, email: string, roles: UserRole[]): Viewer {
  return {
    id,
    name,
    email,
    roles,
    profileComplete: true,
    isActive: true,
    sessionId: crypto.randomUUID(),
  };
}

async function createSlot(labId: string, startsAt: Date, quickVisitCapacity: number) {
  const id = crypto.randomUUID();
  await prisma.labSlot.create({
    data: {
      id,
      labId,
      localDate: new Date(`${startsAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
      startsAt,
      endsAt: new Date(startsAt.getTime() + HOUR),
      bookingCapacity: 20,
      quickVisitCapacity,
      status: "OPEN",
    },
  });
  return id;
}

async function createBooking(
  fixture: Fixture,
  options: {
    startsAt: Date;
    participants: Viewer[];
    status?: BookingStatus;
    attendance?: AttendanceStatus;
  },
) {
  const slotId = await createSlot(fixture.labId, options.startsAt, 5);
  const leader = options.participants[0]!;
  const projectId = crypto.randomUUID();
  await prisma.project.create({
    data: {
      id: projectId,
      labId: fixture.labId,
      title: `${prefix} project ${projectId.slice(0, 8)}`,
      description: "Phase 5 attendance fixture",
      creatorId: leader.id,
      status: ProjectStatus.VERIFIED,
      idempotencyKey: crypto.randomUUID(),
      members: {
        create: options.participants.map((participant, index) => ({
          userId: participant.id,
          email: participant.email,
          role: index === 0 ? ProjectMemberRole.LEADER : ProjectMemberRole.MEMBER,
          status: ProjectMemberStatus.ACCEPTED,
        })),
      },
    },
  });

  const bookingId = crypto.randomUUID();
  const slot = await prisma.labSlot.findUniqueOrThrow({ where: { id: slotId } });
  await prisma.booking.create({
    data: {
      id: bookingId,
      labId: fixture.labId,
      labSlotId: slotId,
      projectId,
      createdById: leader.id,
      idempotencyKey: crypto.randomUUID(),
      creationRequestFingerprint: crypto.randomBytes(32).toString("hex"),
      attendeeCount: options.participants.length,
      status: options.status ?? BookingStatus.CONFIRMED,
      labNameSnapshot: `${prefix} MakerSpace`,
      projectTitleSnapshot: `${prefix} project ${projectId.slice(0, 8)}`,
      slotStartsAtSnapshot: slot.startsAt,
      slotEndsAtSnapshot: slot.endsAt,
      timeZoneSnapshot: "Asia/Kolkata",
      cancellationWindowHoursSnapshot: 0,
      participants: {
        create: options.participants.map((participant, index) => ({
          userId: participant.id,
          attendanceStatus: options.attendance ?? AttendanceStatus.EXPECTED,
          nameSnapshot: participant.name,
          emailSnapshot: participant.email,
          prnSnapshot: null,
          projectRoleSnapshot: index === 0 ? ProjectMemberRole.LEADER : ProjectMemberRole.MEMBER,
        })),
      },
    },
  });
  return { bookingId, projectId, slotId, slot };
}

// ─── verifications ───────────────────────────────────────────────────────────

/** Concurrent Quick Visit requests must never oversubscribe the slot. */
async function verifyQuickVisitCapacityRace(fixture: Fixture) {
  const requesters = fixture.students.slice(0, burstRequests);
  const outcomes = await Promise.allSettled(
    requesters.map((student) =>
      quickVisits.create(student, {
        labSlotId: fixture.burstSlotId,
        purpose: "Prototype iteration",
        idempotencyKey: crypto.randomUUID(),
      }),
    ),
  );
  const confirmed = outcomes.filter((o) => o.status === "fulfilled").length;
  const rejections = tallyCodes(outcomes);
  const live = await prisma.quickVisit.count({
    where: {
      labSlotId: fixture.burstSlotId,
      status: {
        in: [QuickVisitStatus.REQUESTED, QuickVisitStatus.CONFIRMED, QuickVisitStatus.ACTIVE],
      },
    },
  });

  assert(confirmed === burstCapacity, `expected ${burstCapacity} confirmed, got ${confirmed}`);
  assert(live === burstCapacity, `expected ${burstCapacity} live rows, got ${live}`);
  assert(
    rejections.QUICK_VISIT_CAPACITY_EXCEEDED === burstRequests - burstCapacity,
    `unexpected rejection mix ${JSON.stringify(rejections)}`,
  );
  return { requests: burstRequests, confirmed, live, capacity: burstCapacity, rejections };
}

/** The same idempotency key fired concurrently must collapse to one row. */
async function verifyQuickVisitIdempotency(fixture: Fixture) {
  const student = fixture.students[burstRequests]!;
  const idempotencyKey = crypto.randomUUID();
  const attempts = 8;
  const outcomes = await Promise.allSettled(
    Array.from({ length: attempts }, () =>
      quickVisits.create(student, {
        labSlotId: fixture.idempotencySlotId,
        purpose: "Repeat submit",
        idempotencyKey,
      }),
    ),
  );
  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  assert(fulfilled.length === attempts, `all retries should succeed, got ${fulfilled.length}`);
  const ids = new Set(
    fulfilled.map(
      (o) => (o as PromiseFulfilledResult<{ quickVisit: { id: string } }>).value.quickVisit.id,
    ),
  );
  assert(ids.size === 1, `expected 1 Quick Visit, got ${ids.size}`);
  const rows = await prisma.quickVisit.count({
    where: { userId: student.id, labSlotId: fixture.idempotencySlotId },
  });
  assert(rows === 1, `expected 1 persisted row, got ${rows}`);

  // A reused key with a different payload must be rejected, not silently served.
  const mismatch = await capture(() =>
    quickVisits.create(student, {
      labSlotId: fixture.idempotencySlotId,
      purpose: "Completely different purpose",
      idempotencyKey,
    }),
  );
  assert(mismatch === "IDEMPOTENCY_KEY_REUSED", `expected key-reuse guard, got ${mismatch}`);
  return { concurrentRequests: attempts, uniqueRows: ids.size, keyReuseRejected: true };
}

/** A second live request for the same slot by the same person is refused. */
async function verifyDuplicateSlotRequestRejected(fixture: Fixture) {
  const student = fixture.students[burstRequests + 1]!;
  await quickVisits.create(student, {
    labSlotId: fixture.duplicateSlotId,
    purpose: "First request",
    idempotencyKey: crypto.randomUUID(),
  });
  const code = await capture(() =>
    quickVisits.create(student, {
      labSlotId: fixture.duplicateSlotId,
      purpose: "Second request",
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  assert(code === "QUICK_VISIT_ALREADY_REQUESTED", `expected duplicate guard, got ${code}`);
  return { rejectedWith: code };
}

/** Concurrent identical check-ins must produce exactly one attendance row. */
async function verifyCheckInIdempotency(fixture: Fixture) {
  const participants = fixture.students.slice(0, 3);
  const { bookingId } = await createBooking(fixture, {
    startsAt: minutesFromNow(5),
    participants,
  });
  const idempotencyKey = crypto.randomUUID();
  const attempts = 8;
  const outcomes = await Promise.allSettled(
    Array.from({ length: attempts }, () =>
      visits.checkIn(fixture.operator, {
        source: "BOOKING",
        bookingId,
        userId: participants[0]!.id,
        idempotencyKey,
      }),
    ),
  );
  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  assert(fulfilled.length === attempts, `all retries should succeed, got ${fulfilled.length}`);
  const ids = new Set(
    fulfilled.map((o) => (o as PromiseFulfilledResult<{ visit: { id: string } }>).value.visit.id),
  );
  assert(ids.size === 1, `expected 1 visit, got ${ids.size}`);
  const rows = await prisma.visit.count({ where: { bookingId } });
  assert(rows === 1, `expected 1 persisted visit, got ${rows}`);

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assert(
    booking.status === BookingStatus.ACTIVE,
    `first check-in should activate the booking, got ${booking.status}`,
  );
  const history = await prisma.bookingStatusHistory.count({
    where: { bookingId, toStatus: BookingStatus.ACTIVE },
  });
  assert(history === 1, `expected exactly 1 ACTIVE transition, got ${history}`);

  return { concurrentRequests: attempts, uniqueVisits: ids.size, bookingStatus: booking.status };
}

/** One human, one place: an open visit blocks a second concurrent check-in. */
async function verifyDoubleOccupancyBlocked(fixture: Fixture) {
  const student = fixture.students[burstRequests + 2]!;
  const first = await createBooking(fixture, {
    startsAt: minutesFromNow(5),
    participants: [student],
  });
  await visits.checkIn(fixture.operator, {
    source: "BOOKING",
    bookingId: first.bookingId,
    userId: student.id,
    idempotencyKey: crypto.randomUUID(),
  });

  const second = await createBooking(fixture, {
    startsAt: minutesFromNow(6),
    participants: [student],
  });
  const code = await capture(() =>
    visits.checkIn(fixture.operator, {
      source: "BOOKING",
      bookingId: second.bookingId,
      userId: student.id,
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  assert(code === "VISITOR_ALREADY_INSIDE", `expected occupancy guard, got ${code}`);

  const open = await prisma.visit.count({
    where: { userId: student.id, status: AttendanceStatus.CHECKED_IN },
  });
  assert(open === 1, `expected exactly 1 open visit, got ${open}`);
  return { rejectedWith: code, openVisits: open };
}

/** Full happy path: everyone in, everyone out, booking closes itself. */
async function verifyAttendanceLifecycle(fixture: Fixture) {
  const participants = fixture.students.slice(4, 7);
  const { bookingId } = await createBooking(fixture, {
    startsAt: minutesFromNow(5),
    participants,
  });

  const checkedIn = [];
  for (const participant of participants) {
    const result = await visits.checkIn(fixture.operator, {
      source: "BOOKING",
      bookingId,
      userId: participant.id,
      idempotencyKey: crypto.randomUUID(),
    });
    checkedIn.push(result.visit);
  }
  assert(checkedIn.length === participants.length, "every participant should check in");

  const midway = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assert(midway.status === BookingStatus.ACTIVE, `expected ACTIVE, got ${midway.status}`);

  // Check out all but the last: the booking must stay ACTIVE.
  for (const visit of checkedIn.slice(0, -1)) {
    await visits.checkOut(visit.id, { idempotencyKey: crypto.randomUUID() }, fixture.operator);
  }
  const stillActive = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assert(
    stillActive.status === BookingStatus.ACTIVE,
    `booking must stay ACTIVE while someone is inside, got ${stillActive.status}`,
  );

  const lastVisit = checkedIn.at(-1)!;
  const checkOutKey = crypto.randomUUID();
  const closed = await visits.checkOut(
    lastVisit.id,
    { idempotencyKey: checkOutKey },
    fixture.operator,
  );
  assert(closed.visit.status === AttendanceStatus.CHECKED_OUT, "visit should be closed");

  const replay = await visits.checkOut(
    lastVisit.id,
    { idempotencyKey: checkOutKey },
    fixture.operator,
  );
  assert(replay.replayed, "repeat check-out with the same key must replay, not error");

  const completed = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assert(
    completed.status === BookingStatus.COMPLETED,
    `booking should complete once everyone leaves, got ${completed.status}`,
  );
  const attendance = await prisma.bookingParticipant.findMany({ where: { bookingId } });
  assert(
    attendance.every((row) => row.attendanceStatus === AttendanceStatus.CHECKED_OUT),
    "every participant should be CHECKED_OUT",
  );
  const openVisits = await prisma.visit.count({
    where: { bookingId, status: AttendanceStatus.CHECKED_IN },
  });
  assert(openVisits === 0, "no visit should remain open");

  return {
    participants: participants.length,
    bookingStatus: completed.status,
    checkOutReplayed: replay.replayed,
  };
}

/** Live occupancy must equal the number of open visits, and no more. */
async function verifyOccupancyAccuracy(fixture: Fixture) {
  const before = await consoleService.occupancy(fixture.labId, fixture.operator);
  const openRows = await prisma.visit.count({
    where: { labId: fixture.labId, status: AttendanceStatus.CHECKED_IN },
  });
  assert(
    before.current === openRows,
    `occupancy ${before.current} disagrees with ${openRows} open visits`,
  );
  assert(before.inside.length === before.current, "inside[] length must equal the headcount");
  return { current: before.current, openVisits: openRows };
}

/** Check-in is refused outside the permitted window. */
async function verifyCheckInWindowEnforcement(fixture: Fixture) {
  const student = fixture.students[burstRequests + 3]!;
  const early = await createBooking(fixture, {
    startsAt: hoursFromNow(6),
    participants: [student],
  });
  const tooEarly = await capture(() =>
    visits.checkIn(fixture.operator, {
      source: "BOOKING",
      bookingId: early.bookingId,
      userId: student.id,
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  assert(tooEarly === "CHECK_IN_NOT_OPEN_YET", `expected early guard, got ${tooEarly}`);

  const past = await createBooking(fixture, {
    startsAt: hoursAgo(3),
    participants: [student],
  });
  const tooLate = await capture(() =>
    visits.checkIn(fixture.operator, {
      source: "BOOKING",
      bookingId: past.bookingId,
      userId: student.id,
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  assert(tooLate === "SLOT_ALREADY_ENDED", `expected late guard, got ${tooLate}`);
  return { earlyRejectedWith: tooEarly, lateRejectedWith: tooLate };
}

/** The reconciler must resolve every kind of abandoned state. */
async function verifyReconciler(fixture: Fixture) {
  const noShowStudents = fixture.students.slice(7, 9);
  const noShow = await createBooking(fixture, {
    startsAt: hoursAgo(2),
    participants: noShowStudents,
  });

  // A booking whose slot ended two hours ago, with someone still checked in:
  // the visit must auto-close and the booking must then settle.
  const overstayStudent = fixture.students[9]!;
  const overstay = await createBooking(fixture, {
    startsAt: hoursAgo(3),
    participants: [overstayStudent],
    status: BookingStatus.ACTIVE,
  });
  const overstayVisit = await prisma.visit.create({
    data: {
      labId: fixture.labId,
      userId: overstayStudent.id,
      bookingId: overstay.bookingId,
      projectId: overstay.projectId,
      source: "BOOKING",
      status: AttendanceStatus.CHECKED_IN,
      checkInIdempotencyKey: crypto.randomUUID(),
      checkInRequestFingerprint: crypto.randomBytes(32).toString("hex"),
      labNameSnapshot: `${prefix} MakerSpace`,
      timeZoneSnapshot: "Asia/Kolkata",
      userNameSnapshot: overstayStudent.name,
      userEmailSnapshot: overstayStudent.email,
      expectedStartAt: hoursAgo(3),
      expectedEndAt: hoursAgo(2),
      checkedInAt: hoursAgo(3),
      checkedInById: fixture.operator.id,
    },
  });
  await prisma.bookingParticipant.update({
    where: { bookingId_userId: { bookingId: overstay.bookingId, userId: overstayStudent.id } },
    data: { attendanceStatus: AttendanceStatus.CHECKED_IN },
  });

  const expiringStudent = fixture.students[10]!;
  const expiredSlot = await createSlot(fixture.labId, hoursAgo(3), 5);
  const expiringQuickVisit = await prisma.quickVisit.create({
    data: {
      labId: fixture.labId,
      labSlotId: expiredSlot,
      userId: expiringStudent.id,
      idempotencyKey: crypto.randomUUID(),
      creationRequestFingerprint: crypto.randomBytes(32).toString("hex"),
      purpose: "Never arrived",
      status: QuickVisitStatus.CONFIRMED,
      labNameSnapshot: `${prefix} MakerSpace`,
      slotStartsAtSnapshot: hoursAgo(3),
      slotEndsAtSnapshot: hoursAgo(2),
      timeZoneSnapshot: "Asia/Kolkata",
      userNameSnapshot: expiringStudent.name,
      userEmailSnapshot: expiringStudent.email,
    },
  });

  const summary = await reconcileAttendance();

  const releasedBooking = await prisma.booking.findUniqueOrThrow({
    where: { id: noShow.bookingId },
  });
  assert(
    releasedBooking.status === BookingStatus.NO_SHOW,
    `expected NO_SHOW release, got ${releasedBooking.status}`,
  );
  const releasedParticipants = await prisma.bookingParticipant.findMany({
    where: { bookingId: noShow.bookingId },
  });
  assert(
    releasedParticipants.every((row) => row.attendanceStatus === AttendanceStatus.NO_SHOW),
    "absent participants must be marked NO_SHOW",
  );

  const closedVisit = await prisma.visit.findUniqueOrThrow({ where: { id: overstayVisit.id } });
  assert(
    closedVisit.status === AttendanceStatus.CHECKED_OUT,
    `overstaying visit should auto-close, got ${closedVisit.status}`,
  );
  assert(
    closedVisit.closeReason === "AUTO_CLOSED_AT_SLOT_END",
    `expected AUTO_CLOSED_AT_SLOT_END, got ${closedVisit.closeReason}`,
  );
  assert(
    closedVisit.overstayByMinutes >= 110,
    `overstay should be ~120 minutes, got ${closedVisit.overstayByMinutes}`,
  );

  const expiredQuickVisit = await prisma.quickVisit.findUniqueOrThrow({
    where: { id: expiringQuickVisit.id },
  });
  assert(
    expiredQuickVisit.status === QuickVisitStatus.NO_SHOW,
    `expected Quick Visit NO_SHOW, got ${expiredQuickVisit.status}`,
  );

  // A second pass must be a no-op: the reconciler is idempotent.
  const secondPass = await reconcileAttendance();
  assert(
    secondPass.bookingsMarkedNoShow === 0 && secondPass.visitsAutoClosed === 0,
    `second pass should be a no-op, got ${JSON.stringify(secondPass)}`,
  );

  // The overstayed booking settles on the following tick, once its visit closed.
  const settled = await prisma.booking.findUniqueOrThrow({ where: { id: overstay.bookingId } });
  assert(
    settled.status === BookingStatus.COMPLETED,
    `overstayed booking should complete, got ${settled.status}`,
  );

  return {
    firstPass: summary,
    secondPassNoOp: secondPass,
    overstayMinutes: closedVisit.overstayByMinutes,
    releasedBookingStatus: releasedBooking.status,
    expiredQuickVisitStatus: expiredQuickVisit.status,
    settledBookingStatus: settled.status,
  };
}

/** Renaming a lab or a person must not rewrite attendance history. */
async function verifySnapshotImmutability(fixture: Fixture) {
  const student = fixture.students[11]!;
  const booking = await createBooking(fixture, {
    startsAt: minutesFromNow(5),
    participants: [student],
  });
  const { visit } = await visits.checkIn(fixture.operator, {
    source: "BOOKING",
    bookingId: booking.bookingId,
    userId: student.id,
    idempotencyKey: crypto.randomUUID(),
  });

  await prisma.lab.update({ where: { id: fixture.labId }, data: { name: `${prefix} RENAMED` } });
  await prisma.user.update({ where: { id: student.id }, data: { name: "Renamed Person" } });

  const stored = await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
  assert(
    stored.labNameSnapshot === `${prefix} MakerSpace`,
    `lab snapshot mutated to ${stored.labNameSnapshot}`,
  );
  assert(
    stored.userNameSnapshot === student.name,
    `visitor snapshot mutated to ${stored.userNameSnapshot}`,
  );

  await prisma.lab.update({
    where: { id: fixture.labId },
    data: { name: `${prefix} MakerSpace` },
  });
  return { labNamePreserved: true, visitorNamePreserved: true };
}

/** A student must never see another student's contact details. */
async function verifyPiiGating(fixture: Fixture) {
  const subject = fixture.students[0]!;
  const stranger = fixture.students[1]!;
  const anyVisit = await prisma.visit.findFirst({
    where: { labId: fixture.labId, userId: subject.id },
    orderBy: { checkedInAt: "desc" },
  });
  assert(Boolean(anyVisit), "expected at least one visit for the PII check");

  const asOperator = await visits.get(anyVisit!.id, fixture.operator);
  assert("email" in asOperator.visitor, "operators must see contact details");

  const asSubject = await visits.get(anyVisit!.id, subject);
  assert("email" in asSubject.visitor, "a visitor must see their own details");

  const forbidden = await capture(() => visits.get(anyVisit!.id, stranger));
  assert(forbidden === "FORBIDDEN", `a stranger must be refused, got ${forbidden}`);

  const strangerList = await visits.list({}, stranger);
  assert(
    strangerList.data.every((row) => row.userId === stranger.id),
    "a student's visit list must contain only their own visits",
  );
  return { operatorSeesPii: true, ownerSeesPii: true, strangerRefused: true };
}

/** The console must return a coherent day in a single call. */
async function verifyConsoleShape(fixture: Fixture) {
  const today = new Date().toISOString().slice(0, 10);
  const roster = await consoleService.roster(fixture.labId, today, fixture.operator);
  assert(Array.isArray(roster.slots), "console must return slots");
  assert(typeof roster.occupancy.current === "number", "console must return occupancy");
  const participantCount = roster.slots
    .flatMap((slot) => slot.bookings)
    .flatMap((booking) => booking.participants).length;
  return {
    slots: roster.slots.length,
    bookings: roster.slots.reduce((sum, slot) => sum + slot.bookings.length, 0),
    participants: participantCount,
    occupancy: roster.occupancy.current,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * HOUR);
}
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR);
}
function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * MINUTE);
}

function bounded(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function assert(condition: boolean, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function codeOf(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code: unknown }).code)
    : message(error);
}

async function capture(run: () => Promise<unknown>) {
  try {
    await run();
    return "NO_ERROR";
  } catch (error) {
    return codeOf(error);
  }
}

function tallyCodes(outcomes: PromiseSettledResult<unknown>[]) {
  const tally: Record<string, number> = {};
  for (const outcome of outcomes) {
    if (outcome.status !== "rejected") continue;
    const code = codeOf(outcome.reason);
    tally[code] = (tally[code] ?? 0) + 1;
  }
  return tally;
}

async function cleanup() {
  const labs = await prisma.lab.findMany({
    where: { code: { startsWith: `P5L${runToken}`.toUpperCase() } },
    select: { id: true },
  });
  const labIds = labs.map((row) => row.id);
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${prefix}-` } },
    select: { id: true },
  });
  const userIds = users.map((row) => row.id);
  if (!labIds.length && !userIds.length) return;

  const bookings = await prisma.booking.findMany({
    where: { OR: [{ labId: { in: labIds } }, { createdById: { in: userIds } }] },
    select: { id: true },
  });
  const bookingIds = bookings.map((row) => row.id);
  const projects = await prisma.project.findMany({
    where: { OR: [{ labId: { in: labIds } }, { creatorId: { in: userIds } }] },
    select: { id: true },
  });
  const projectIds = projects.map((row) => row.id);
  const notifications = await prisma.notification.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const notificationIds = notifications.map((row) => row.id);

  await prisma.notificationDelivery.deleteMany({
    where: { notificationId: { in: notificationIds } },
  });
  await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
  await prisma.visit.deleteMany({
    where: { OR: [{ labId: { in: labIds } }, { userId: { in: userIds } }] },
  });
  await prisma.quickVisit.deleteMany({
    where: { OR: [{ labId: { in: labIds } }, { userId: { in: userIds } }] },
  });
  await prisma.bookingEquipment.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.labSlot.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ actorUserId: { in: userIds } }, { entityId: { in: [...bookingIds, ...projectIds] } }],
    },
  });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.lab.deleteMany({ where: { id: { in: labIds } } });
  await prisma.programme.deleteMany({
    where: { code: { startsWith: `P5P${runToken}`.toUpperCase() } },
  });
  await prisma.department.deleteMany({
    where: { code: { startsWith: `P5D${runToken}`.toUpperCase() } },
  });

  const leftoverVisits = await prisma.visit.count({ where: { labId: { in: labIds } } });
  const leftoverUsers = await prisma.user.count({ where: { id: { in: userIds } } });
  if (leftoverVisits || leftoverUsers) {
    throw new Error(`fixtures survived cleanup: visits=${leftoverVisits} users=${leftoverUsers}`);
  }
}

/** Both clients hold the event loop open; a CLI must close them explicitly. */
async function teardown() {
  await prisma.$disconnect();
  redis.disconnect();
}

main()
  .then(async (result) => {
    console.log(JSON.stringify(result));
    await teardown();
  })
  .catch(async (error: unknown) => {
    console.error(JSON.stringify({ ok: false, error: message(error) }));
    await teardown();
    process.exit(1);
  });
