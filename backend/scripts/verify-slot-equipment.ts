/**
 * Per-slot equipment reservation.
 *
 * A team claims machines for one booked slot; those units are unavailable to
 * other teams *in that slot only*, and come back the moment the booking stops
 * being live. This exercises that against a real PostgreSQL database, including
 * the concurrent case where two teams reach for the last unit at once.
 *
 * Run:
 *   RUN_SLOT_EQUIPMENT_TESTS=true npx tsx scripts/verify-slot-equipment.ts
 */
import crypto from "node:crypto";
import {
  AttendanceStatus,
  BookingStatus,
  EquipmentStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
  VisitSource,
} from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import { cancel, completeOwnBooking, create } from "../src/modules/bookings/booking-service.js";
import { dailyAvailability } from "../src/modules/labs/lab-service.js";

type Viewer = NonNullable<Express.Request["user"]>;

const enabled = process.env.RUN_SLOT_EQUIPMENT_TESTS === "true";
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const prefix = `slotkit-${runToken}`;
const startedAt = Date.now();
const registry = {
  labIds: [] as string[],
  userIds: [] as string[],
  projectIds: [] as string[],
  departmentIds: [] as string[],
  programmeIds: [] as string[],
};

async function main() {
  if (!enabled) {
    throw new Error(
      "Refusing to mutate the configured database. Set RUN_SLOT_EQUIPMENT_TESTS=true explicitly.",
    );
  }
  let assertions: Record<string, unknown> | undefined;
  let testFailure: unknown;
  let cleanupFailure: unknown;
  try {
    assertions = await run();
  } catch (error) {
    testFailure = error;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (testFailure || cleanupFailure) {
    console.error(
      JSON.stringify({
        ok: false,
        ...(testFailure ? { failure: describe(testFailure) } : {}),
        ...(cleanupFailure ? { cleanupFailure: describe(cleanupFailure) } : {}),
      }),
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify({
      ok: true,
      assertions,
      cleanup: "verified",
      elapsedMs: Date.now() - startedAt,
    }),
  );
}

async function run() {
  const fx = await fixture();
  return {
    holdsRecorded: await verifyHoldsRecorded(fx),
    slotScoped: await verifySlotScoped(fx),
    contention: await verifyContention(fx),
    releaseOnCancel: await verifyReleaseOnCancel(fx),
    releaseOnComplete: await verifyReleaseOnComplete(fx),
    foreignEquipmentRejected: await verifyForeignEquipmentRejected(fx),
    outOfServiceRejected: await verifyOutOfServiceRejected(fx),
    oneLiveBookingPerStudent: await verifyOneLiveBooking(fx),
    concurrentLastUnit: await verifyConcurrentLastUnit(fx),
  };
}

/* ── fixtures ─────────────────────────────────────────────────────────────── */

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture() {
  const departmentId = crypto.randomUUID();
  const programmeId = crypto.randomUUID();
  const labId = crypto.randomUUID();
  registry.departmentIds.push(departmentId);
  registry.programmeIds.push(programmeId);
  registry.labIds.push(labId);

  await prisma.department.create({
    data: { id: departmentId, code: `SK${runToken}`.toUpperCase(), name: `${prefix} department` },
  });
  await prisma.programme.create({
    data: {
      id: programmeId,
      departmentId,
      code: `SKP${runToken}`.toUpperCase(),
      name: `${prefix} programme`,
    },
  });
  await prisma.lab.create({
    data: {
      id: labId,
      code: `SKL${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      description: "Temporary slot-equipment fixture",
      timeZone: "Asia/Kolkata",
      slotDurationMinutes: 60,
      bookingCapacity: 8,
      quickVisitCapacity: 4,
      bookingHorizonDays: 14,
      cancellationWindowHours: 0,
      maxFutureBookingsPerProject: null,
      // The behaviour under test: one live session per student.
      maxLiveBookingsPerStudent: 1,
      projectVerificationRequired: true,
      teamLeaderAttendanceRequired: true,
      schedules: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          opensAtMinute: 0,
          closesAtMinute: 23 * 60,
          isOpen: true,
        })),
      },
    },
  });

  const categoryId = crypto.randomUUID();
  await prisma.equipmentCategory.create({
    data: { id: categoryId, labId, name: `${prefix} printers` },
  });
  // One unit only: contention is the interesting case, and a single unit makes
  // "taken by another team" unambiguous.
  const printer = await prisma.equipment.create({
    data: {
      labId,
      categoryId,
      name: `${prefix} printer`,
      description: "Single-unit machine used to prove exclusive holds.",
      totalQuantity: 1,
      availableQuantity: 1,
    },
  });
  const bench = await prisma.equipment.create({
    data: {
      labId,
      categoryId,
      name: `${prefix} bench`,
      description: "A second machine, never claimed, to prove holds are per-machine.",
      totalQuantity: 2,
      availableQuantity: 2,
    },
  });
  const broken = await prisma.equipment.create({
    data: {
      labId,
      categoryId,
      name: `${prefix} broken lathe`,
      description: "Out of service, to prove status is respected at booking time.",
      totalQuantity: 1,
      availableQuantity: 1,
      status: EquipmentStatus.UNDER_MAINTENANCE,
    },
  });

  const users = await createUsers(departmentId, programmeId, 4);
  const projectA = await createProject(
    labId,
    `${prefix} project A`,
    [users[0]!],
    [printer.id, bench.id, broken.id],
  );
  const projectB = await createProject(labId, `${prefix} project B`, [users[1]!], [printer.id]);
  const projectC = await createProject(labId, `${prefix} project C`, [users[2]!], [printer.id]);
  const projectD = await createProject(labId, `${prefix} project D`, [users[3]!], [printer.id]);

  // Let the lab's own generator produce the slots, then book the ones it made.
  // Hand-written slots would be reconciled away on the first availability read,
  // and would also not prove the real generation path works with holds.
  const targetDate = localDate(new Date(Date.now() + 48 * 60 * 60 * 1000), "Asia/Kolkata");
  const generated = (await dailyAvailability(labId, targetDate, undefined, 1, {
    id: users[0]!.id,
    name: users[0]!.name,
    email: users[0]!.email,
    roles: [UserRole.STUDENT],
  } as Viewer)) as unknown as { slots: { id: string }[] };
  if (generated.slots.length < 4) {
    throw new Error(`expected at least 4 generated slots, got ${generated.slots.length}`);
  }
  const [slotOne, slotTwo, slotThree, slotFour] = generated.slots.map((slot) => slot.id) as [
    string,
    string,
    string,
    string,
  ];

  return {
    labId,
    printerId: printer.id,
    benchId: bench.id,
    brokenId: broken.id,
    projectA,
    projectB,
    projectC,
    projectD,
    slotOne,
    slotTwo,
    slotThree,
    slotFour,
    localDate: targetDate,
  };
}

type CreatedUser = { id: string; name: string; email: string; prn: string };
type CreatedProject = { id: string; leader: Viewer; participantIds: string[] };

async function createUsers(departmentId: string, programmeId: string, count: number) {
  const users: CreatedUser[] = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    name: `${prefix} student ${index + 1}`,
    email: `${prefix}-${index + 1}@mitwpu.edu.in`,
    prn: `SK${runToken}${index + 1}`.toUpperCase().slice(0, 24),
  }));
  registry.userIds.push(...users.map((user) => user.id));
  await prisma.user.createMany({
    data: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: [UserRole.STUDENT],
      profileComplete: true,
      isActive: true,
    })),
  });
  await prisma.studentProfile.createMany({
    data: users.map((user) => ({
      userId: user.id,
      prn: user.prn,
      departmentId,
      programmeId,
      academicYear: 1,
    })),
  });
  return users;
}

async function createProject(
  labId: string,
  title: string,
  team: CreatedUser[],
  equipmentIds: string[],
) {
  const leader = team[0]!;
  const id = crypto.randomUUID();
  registry.projectIds.push(id);
  await prisma.project.create({
    data: {
      id,
      labId,
      creatorId: leader.id,
      title,
      description: "Temporary project for slot-equipment verification.",
      status: ProjectStatus.VERIFIED,
      submittedAt: new Date(),
      members: {
        create: team.map((user, index) => ({
          userId: user.id,
          email: user.email,
          role: index === 0 ? ProjectMemberRole.LEADER : ProjectMemberRole.MEMBER,
          status: ProjectMemberStatus.ACCEPTED,
          acceptedAt: new Date(),
          respondedAt: new Date(),
        })),
      },
      equipmentRequirements: {
        create: equipmentIds.map((equipmentId) => ({ equipmentId, quantity: 1 })),
      },
    },
  });
  return {
    id,
    participantIds: team.map((user) => user.id),
    leader: {
      id: leader.id,
      name: leader.name,
      email: leader.email,
      roles: [UserRole.STUDENT],
    } as Viewer,
  } satisfies CreatedProject;
}

function localDate(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

async function book(project: CreatedProject, labSlotId: string, equipmentIds: string[]) {
  return create(project.leader, {
    idempotencyKey: crypto.randomUUID(),
    labSlotId,
    projectId: project.id,
    participantIds: project.participantIds,
    equipmentIds,
  });
}

/* ── verifications ────────────────────────────────────────────────────────── */

async function verifyHoldsRecorded(fx: Fixture) {
  const { booking } = await book(fx.projectA, fx.slotOne, [fx.printerId, fx.benchId]);
  const rows = await prisma.bookingEquipment.findMany({ where: { bookingId: booking.id } });
  assert(rows.length === 2, `two holds expected, got ${rows.length}`);
  assert(
    rows.every((row) => row.nameSnapshot.startsWith(prefix)),
    "each hold must snapshot the machine name, so a later rename cannot rewrite history",
  );
  assert(booking.equipment.length === 2, "the booking payload must report the machines it holds");
  await cancel(booking.id, "fixture reset", crypto.randomUUID(), fx.projectA.leader);
  return { holds: rows.length, snapshotted: true };
}

async function verifySlotScoped(fx: Fixture) {
  const { booking } = await book(fx.projectA, fx.slotOne, [fx.printerId]);

  const dayOne = await availabilityFor(fx, fx.projectB);
  const claimedSlot = slotById(dayOne, fx.slotOne);
  const freeSlot = slotById(dayOne, fx.slotTwo);
  const printerIn = (slot: SlotView) =>
    slot.equipment.find((item) => item.equipmentId === fx.printerId)!;

  assert(
    printerIn(claimedSlot).available === false,
    "the claimed slot must show the machine taken",
  );
  assert(
    printerIn(claimedSlot).claimedQuantity === 1,
    `one unit should be claimed, got ${printerIn(claimedSlot).claimedQuantity}`,
  );
  assert(
    printerIn(freeSlot).available === true,
    "a different slot must still show the machine free — holds are per slot, not per day",
  );
  assert(
    claimedSlot.equipmentAvailable === 0 && freeSlot.equipmentAvailable === 1,
    "the per-slot machine tally must reflect the holds",
  );

  await cancel(booking.id, "fixture reset", crypto.randomUUID(), fx.projectA.leader);
  return { takenInBookedSlot: true, freeInOtherSlot: true };
}

async function verifyContention(fx: Fixture) {
  const { booking } = await book(fx.projectA, fx.slotOne, [fx.printerId]);
  const refused = await expectFailure(() => book(fx.projectB, fx.slotOne, [fx.printerId]));
  assert(
    refused === "EQUIPMENT_UNAVAILABLE",
    `a second team must be refused the last unit, got ${refused}`,
  );

  // The seat is still bookable without the machine: equipment contention must
  // not block a team that does not need the machine.
  const seatOnly = await book(fx.projectB, fx.slotOne, []);
  assert(seatOnly.booking.id, "booking the slot without the machine must still succeed");

  await cancel(booking.id, "fixture reset", crypto.randomUUID(), fx.projectA.leader);
  await cancel(seatOnly.booking.id, "fixture reset", crypto.randomUUID(), fx.projectB.leader);
  return { secondClaimRefused: true, seatStillBookable: true };
}

async function verifyReleaseOnCancel(fx: Fixture) {
  const { booking } = await book(fx.projectA, fx.slotOne, [fx.printerId]);
  await cancel(booking.id, "changed our plans", crypto.randomUUID(), fx.projectA.leader);

  const after = await availabilityFor(fx, fx.projectB);
  const printer = slotById(after, fx.slotOne).equipment.find(
    (item) => item.equipmentId === fx.printerId,
  )!;
  assert(printer.available === true, "cancelling must release the machine");
  assert(printer.claimedQuantity === 0, "a cancelled booking must hold nothing");

  // And the release is real, not merely cosmetic: another team can now book it.
  const second = await book(fx.projectB, fx.slotOne, [fx.printerId]);
  assert(second.booking.equipment.length === 1, "the freed machine must be claimable again");
  await cancel(second.booking.id, "fixture reset", crypto.randomUUID(), fx.projectB.leader);
  return { releasedOnCancel: true, rebookable: true };
}

async function verifyReleaseOnComplete(fx: Fixture) {
  const { booking } = await book(fx.projectA, fx.slotTwo, [fx.printerId]);

  // A student may end a session only once checked in; before that, ending is
  // refused rather than silently allowed.
  const tooEarly = await expectFailure(() => completeOwnBooking(booking.id, fx.projectA.leader));
  assert(
    tooEarly === "BOOKING_NOT_ACTIVE",
    `ending a session before check-in must be refused, got ${tooEarly}`,
  );

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.ACTIVE },
  });
  const visit = await prisma.visit.create({
    data: {
      labId: fx.labId,
      bookingId: booking.id,
      userId: fx.projectA.leader.id,
      source: VisitSource.BOOKING,
      status: AttendanceStatus.CHECKED_IN,
      checkInIdempotencyKey: crypto.randomUUID(),
      checkInRequestFingerprint: "0".repeat(64),
      labNameSnapshot: `${prefix} MakerSpace`,
      timeZoneSnapshot: "Asia/Kolkata",
      userNameSnapshot: fx.projectA.leader.name,
      userEmailSnapshot: fx.projectA.leader.email,
      expectedStartAt: new Date(booking.startsAt),
      expectedEndAt: new Date(booking.endsAt),
      checkedInAt: new Date(),
      checkedInById: fx.projectA.leader.id,
    },
  });

  const ended = await completeOwnBooking(booking.id, fx.projectA.leader);
  assert(ended.status === BookingStatus.COMPLETED, "ending must complete the booking");

  const closedVisit = await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
  assert(
    closedVisit.status === AttendanceStatus.CHECKED_OUT,
    "ending a session must close the open visit, so attendance cannot disagree",
  );
  assert(
    closedVisit.closeReason === "STUDENT_ENDED",
    `the close reason must record who ended it, got ${closedVisit.closeReason}`,
  );

  const after = await availabilityFor(fx, fx.projectB, fx.slotTwo);
  const printer = slotById(after, fx.slotTwo).equipment.find(
    (item) => item.equipmentId === fx.printerId,
  )!;
  assert(printer.available === true, "ending the session must release the machine");

  // Idempotent: a second tap is a no-op, not a failure.
  const again = await completeOwnBooking(booking.id, fx.projectA.leader);
  assert(again.status === BookingStatus.COMPLETED, "ending twice must not error");
  return {
    refusedBeforeCheckIn: true,
    releasedOnComplete: true,
    visitClosed: true,
    idempotent: true,
  };
}

async function verifyForeignEquipmentRejected(fx: Fixture) {
  // projectB never listed the bench, so it cannot claim it.
  const code = await expectFailure(() => book(fx.projectB, fx.slotThree, [fx.benchId]));
  assert(
    code === "EQUIPMENT_NOT_IN_PROJECT",
    `claiming a machine the project never listed must be refused, got ${code}`,
  );
  return { refused: true };
}

async function verifyOutOfServiceRejected(fx: Fixture) {
  const code = await expectFailure(() => book(fx.projectA, fx.slotThree, [fx.brokenId]));
  assert(
    code === "EQUIPMENT_OUT_OF_SERVICE",
    `a machine under maintenance must be refused, got ${code}`,
  );
  return { refused: true };
}

async function verifyOneLiveBooking(fx: Fixture) {
  const first = await book(fx.projectA, fx.slotThree, []);
  const code = await expectFailure(() => book(fx.projectA, fx.slotFour, []));
  assert(
    code === "ACTIVE_BOOKING_EXISTS",
    `a student must hold one live booking at a time, got ${code}`,
  );
  await cancel(first.booking.id, "fixture reset", crypto.randomUUID(), fx.projectA.leader);

  // Cancelling frees them to book again — the limit is on live bookings, not a
  // lifetime quota.
  const second = await book(fx.projectA, fx.slotFour, []);
  assert(second.booking.id, "cancelling must free the student to book again");
  await cancel(second.booking.id, "fixture reset", crypto.randomUUID(), fx.projectA.leader);
  return { secondBookingRefused: true, freedAfterCancel: true };
}

async function verifyConcurrentLastUnit(fx: Fixture) {
  // Two teams reach for the single printer in the same slot at the same instant.
  const settled = await Promise.allSettled([
    book(fx.projectC, fx.slotFour, [fx.printerId]),
    book(fx.projectD, fx.slotFour, [fx.printerId]),
  ]);
  const winners = settled.filter((result) => result.status === "fulfilled");
  const losers = settled.filter((result) => result.status === "rejected");
  assert(
    winners.length === 1 && losers.length === 1,
    `exactly one team may win the last unit, got ${winners.length} winners`,
  );

  const holds = await prisma.bookingEquipment.count({
    where: {
      equipmentId: fx.printerId,
      booking: {
        labSlotId: fx.slotFour,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
      },
    },
  });
  assert(holds === 1, `the database must hold exactly one claim, found ${holds}`);
  return { winners: winners.length, losers: losers.length, holdsInDatabase: holds };
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

type SlotView = {
  id: string;
  equipment: {
    equipmentId: string;
    available: boolean;
    claimedQuantity: number;
    remainingQuantity: number;
  }[];
  equipmentAvailable: number;
};

async function availabilityFor(fx: Fixture, project: CreatedProject, slotId?: string) {
  void slotId;
  return (await dailyAvailability(
    fx.labId,
    fx.localDate,
    project.id,
    1,
    project.leader,
  )) as unknown as { slots: SlotView[] };
}

function slotById(day: { slots: SlotView[] }, slotId: string) {
  const slot = day.slots.find((candidate) => candidate.id === slotId);
  assert(slot, `slot ${slotId} missing from availability`);
  return slot;
}

async function expectFailure(action: () => Promise<unknown>) {
  try {
    await action();
    return "NO_ERROR";
  } catch (error) {
    return (error as { code?: string }).code ?? "UNKNOWN";
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function describe(error: unknown) {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  return { message: String(error) };
}

async function cleanup() {
  const bookings = await prisma.booking.findMany({
    where: { labId: { in: registry.labIds } },
    select: { id: true },
  });
  const bookingIds = bookings.map((row) => row.id);
  if (bookingIds.length) {
    await prisma.bookingEquipment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.visit.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }
  const notifications = await prisma.notification.findMany({
    where: { userId: { in: registry.userIds } },
    select: { id: true },
  });
  if (notifications.length) {
    const ids = notifications.map((row) => row.id);
    await prisma.notificationDelivery.deleteMany({ where: { notificationId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: registry.userIds } } });
  await prisma.projectEquipmentRequirement.deleteMany({
    where: { projectId: { in: registry.projectIds } },
  });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: registry.projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: registry.projectIds } } });
  await prisma.quickVisit.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.visit.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.labSlot.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.equipment.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.equipmentCategory.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.labSchedule.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.lab.deleteMany({ where: { id: { in: registry.labIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: registry.userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: registry.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: registry.userIds } } });
  await prisma.programme.deleteMany({ where: { id: { in: registry.programmeIds } } });
  await prisma.department.deleteMany({ where: { id: { in: registry.departmentIds } } });

  const leftover = await prisma.user.count({ where: { id: { in: registry.userIds } } });
  if (leftover > 0) throw new Error(`${leftover} fixture users survived cleanup`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});
