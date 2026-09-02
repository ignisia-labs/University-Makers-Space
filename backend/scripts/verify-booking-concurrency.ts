import crypto from "node:crypto";
import {
  BookingStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import { cancel, create, get, list } from "../src/modules/bookings/booking-service.js";

type Viewer = NonNullable<Express.Request["user"]>;
type CreatedUser = { id: string; name: string; email: string; prn: string };
type CreatedProject = { id: string; title: string; participantIds: string[]; leader: Viewer };
type FixtureRegistry = {
  prefix: string;
  departmentIds: string[];
  programmeIds: string[];
  labIds: string[];
  slotIds: string[];
  userIds: string[];
  projectIds: string[];
  bookingIds: string[];
};

const testEnabled = process.env.RUN_PHASE4_DATABASE_TESTS === "true";
const burstRequests = boundedInteger(process.env.PHASE4_BURST_REQUESTS, 40, 2, 200);
const burstCapacity = boundedInteger(process.env.PHASE4_BURST_CAPACITY, 20, 1, 100);
const startedAt = Date.now();
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const prefix = `phase4-${runToken}`;
const registry: FixtureRegistry = {
  prefix,
  departmentIds: [],
  programmeIds: [],
  labIds: [],
  slotIds: [],
  userIds: [],
  projectIds: [],
  bookingIds: [],
};

async function main() {
  if (!testEnabled) {
    throw new Error(
      "Refusing to mutate the configured database. Set RUN_PHASE4_DATABASE_TESTS=true explicitly.",
    );
  }
  assert(
    burstCapacity < burstRequests,
    "PHASE4_BURST_CAPACITY must be smaller than PHASE4_BURST_REQUESTS",
  );

  let assertions: Record<string, unknown> | undefined;
  let testFailure: unknown;
  let cleanupFailure: unknown;
  try {
    assertions = await runVerification();
  } catch (error) {
    testFailure = error;
  } finally {
    try {
      await cleanupFixtures(registry);
    } catch (error) {
      cleanupFailure = error;
    }
  }

  if (testFailure || cleanupFailure) {
    const parts = [
      testFailure ? `verification: ${errorMessage(testFailure)}` : null,
      cleanupFailure ? `cleanup: ${errorMessage(cleanupFailure)}` : null,
    ].filter(Boolean);
    throw new Error(parts.join("; "));
  }

  return {
    ok: true,
    assertions,
    cleanup: "verified",
    elapsedMs: Date.now() - startedAt,
  };
}

async function runVerification() {
  const fixture = await createFixtureData(registry);

  const capacityRace = await verifyCapacityRace(fixture.capacitySlotId, fixture.capacityProjects);
  const identicalRetries = await verifyIdenticalCreateRetries(
    fixture.retrySlotId,
    fixture.retryProject,
  );

  await prisma.lab.update({
    where: { id: fixture.labId },
    data: { maxFutureBookingsPerProject: 1 },
  });
  const futureLimit = await verifyFutureLimitRace(fixture.limitSlotIds, fixture.limitProject);
  const cancellation = await verifyCancellationAndCapacityRelease(
    fixture.cancellationSlotId,
    fixture.cancellationProject,
    fixture.replacementProject,
  );
  const hotSlotBurst = await verifyHotSlotBurst(
    fixture.burstSlotId,
    fixture.burstProjects,
    burstCapacity,
  );
  const snapshots = await verifySnapshotImmutability(
    fixture.labId,
    identicalRetries.bookingId,
    fixture.retryProject,
    fixture.baseUsers.slice(0, 4),
  );
  const removedArtifacts = await verifyRemovedArtifacts(identicalRetries.bookingId);

  return {
    capacityRace,
    identicalRetries: identicalRetries.result,
    futureLimit,
    cancellation,
    hotSlotBurst,
    snapshots,
    removedArtifacts,
  };
}

async function createFixtureData(target: FixtureRegistry) {
  const departmentId = crypto.randomUUID();
  const programmeId = crypto.randomUUID();
  const labId = crypto.randomUUID();
  target.departmentIds.push(departmentId);
  target.programmeIds.push(programmeId);
  target.labIds.push(labId);

  await prisma.department.create({
    data: { id: departmentId, code: `P4${runToken}`.toUpperCase(), name: `${prefix} department` },
  });
  await prisma.programme.create({
    data: {
      id: programmeId,
      departmentId,
      code: `P4P${runToken}`.toUpperCase(),
      name: `${prefix} programme`,
    },
  });
  await prisma.lab.create({
    data: {
      id: labId,
      code: `P4L${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      description: "Temporary Phase 4 concurrency fixture",
      timeZone: "Asia/Kolkata",
      slotDurationMinutes: 60,
      bookingCapacity: 4,
      quickVisitCapacity: 10,
      quickVisitsEnabled: true,
      bookingHorizonDays: 14,
      cancellationWindowHours: 0,
      maxFutureBookingsPerProject: null,
      // This suite deliberately drives several concurrent bookings from the
      // same leader to probe capacity and idempotency, so the one-live-session
      // rule is lifted here. It is verified on its own in verify-slot-equipment.
      maxLiveBookingsPerStudent: null,
      projectVerificationRequired: true,
      teamLeaderAttendanceRequired: true,
    },
  });

  const baseUsers = await createUsers(target, departmentId, programmeId, 8, "base");
  const teamA = baseUsers.slice(0, 4);
  const teamB = baseUsers.slice(4, 8);
  const capacityProjects = [
    await createProject(target, labId, `${prefix} capacity A`, teamA),
    await createProject(target, labId, `${prefix} capacity B`, teamB),
  ] as const;
  const retryProject = await createProject(target, labId, `${prefix} retry`, teamA);
  const limitProject = await createProject(target, labId, `${prefix} future limit`, teamB);
  const cancellationProject = await createProject(target, labId, `${prefix} cancellation`, teamA);
  const replacementProject = await createProject(target, labId, `${prefix} replacement`, teamB);

  const baseStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
  baseStart.setUTCMinutes(0, 0, 0);
  const capacitySlotId = await createSlot(target, labId, baseStart, 4);
  const retrySlotId = await createSlot(target, labId, hoursAfter(baseStart, 2), 4);
  const limitSlotIds = [
    await createSlot(target, labId, hoursAfter(baseStart, 4), 4),
    await createSlot(target, labId, hoursAfter(baseStart, 6), 4),
  ] as const;
  const cancellationSlotId = await createSlot(target, labId, hoursAfter(baseStart, 8), 4);
  const burstSlotId = await createSlot(target, labId, hoursAfter(baseStart, 10), burstCapacity);

  const burstUsers = await createUsers(target, departmentId, programmeId, burstRequests, "burst");
  const burstProjects = await createSingleParticipantProjects(target, labId, burstUsers);

  return {
    labId,
    baseUsers,
    capacityProjects,
    retryProject,
    limitProject,
    cancellationProject,
    replacementProject,
    capacitySlotId,
    retrySlotId,
    limitSlotIds,
    cancellationSlotId,
    burstSlotId,
    burstProjects,
  };
}

async function createUsers(
  target: FixtureRegistry,
  departmentId: string,
  programmeId: string,
  count: number,
  group: string,
) {
  const users: CreatedUser[] = Array.from({ length: count }, (_, index) => {
    const sequence = target.userIds.length + index + 1;
    return {
      id: crypto.randomUUID(),
      name: `${prefix} ${group} student ${index + 1}`,
      email: `${prefix}-${group}-${index + 1}@mitwpu.edu.in`,
      prn: `P4${runToken}${sequence}`.toUpperCase().slice(0, 24),
    };
  });
  target.userIds.push(...users.map((user) => user.id));
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
  target: FixtureRegistry,
  labId: string,
  title: string,
  team: CreatedUser[],
) {
  const leader = required(team[0], "A project team requires a leader");
  const id = crypto.randomUUID();
  target.projectIds.push(id);
  await prisma.project.create({
    data: {
      id,
      labId,
      creatorId: leader.id,
      title,
      description: "Temporary verified project for Phase 4 database verification.",
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
    },
  });
  return {
    id,
    title,
    participantIds: team.map((user) => user.id),
    leader: viewerFor(leader),
  } satisfies CreatedProject;
}

async function createSingleParticipantProjects(
  target: FixtureRegistry,
  labId: string,
  users: CreatedUser[],
) {
  const projects = users.map((user, index) => ({
    id: crypto.randomUUID(),
    title: `${prefix} burst project ${index + 1}`,
    user,
  }));
  target.projectIds.push(...projects.map((project) => project.id));
  await prisma.project.createMany({
    data: projects.map((project) => ({
      id: project.id,
      labId,
      creatorId: project.user.id,
      title: project.title,
      description: "Temporary hot-slot load project.",
      status: ProjectStatus.VERIFIED,
      submittedAt: new Date(),
    })),
  });
  await prisma.projectMember.createMany({
    data: projects.map((project) => ({
      projectId: project.id,
      userId: project.user.id,
      email: project.user.email,
      role: ProjectMemberRole.LEADER,
      status: ProjectMemberStatus.ACCEPTED,
      acceptedAt: new Date(),
      respondedAt: new Date(),
    })),
  });
  return projects.map(
    (project) =>
      ({
        id: project.id,
        title: project.title,
        participantIds: [project.user.id],
        leader: viewerFor(project.user),
      }) satisfies CreatedProject,
  );
}

async function createSlot(
  target: FixtureRegistry,
  labId: string,
  startsAt: Date,
  capacity: number,
) {
  const id = crypto.randomUUID();
  target.slotIds.push(id);
  await prisma.labSlot.create({
    data: {
      id,
      labId,
      localDate: localDateInTimeZone(startsAt, "Asia/Kolkata"),
      startsAt,
      endsAt: hoursAfter(startsAt, 1),
      bookingCapacity: capacity,
      quickVisitCapacity: 10,
      policyVersion: 1,
      status: "OPEN",
    },
  });
  return id;
}

async function verifyCapacityRace(slotId: string, projects: readonly CreatedProject[]) {
  const settled = await Promise.allSettled(
    projects.map((project) =>
      create(
        project.leader,
        {
          labSlotId: slotId,
          projectId: project.id,
          participantIds: project.participantIds,
          idempotencyKey: crypto.randomUUID(),
        },
        requestContext("capacity-race"),
      ),
    ),
  );
  const fulfilled = fulfilledResults(settled);
  const rejected = rejectedResults(settled);
  assert(fulfilled.length === 1, `Capacity race produced ${fulfilled.length} winners, expected 1`);
  assert(rejected.length === 1, `Capacity race produced ${rejected.length} conflicts, expected 1`);
  assert(
    errorCode(rejected[0]) === "SLOT_CAPACITY_EXCEEDED",
    `Capacity loser returned ${errorCode(rejected[0]) ?? "no stable error code"}`,
  );
  const live = await liveBookingsForSlot(slotId);
  assert(live.count === 1 && live.occupancy === 4, "Capacity race persisted invalid occupancy");
  registry.bookingIds.push(...live.ids);
  return { winners: 1, conflicts: 1, occupancy: live.occupancy, capacity: 4 };
}

async function verifyIdenticalCreateRetries(slotId: string, project: CreatedProject) {
  const idempotencyKey = crypto.randomUUID();
  const settled = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      create(
        project.leader,
        {
          labSlotId: slotId,
          projectId: project.id,
          participantIds: project.participantIds,
          idempotencyKey,
          notes: "Concurrent identical retry",
        },
        requestContext(`create-retry-${index + 1}`),
      ),
    ),
  );
  const fulfilled = fulfilledResults(settled);
  assert(fulfilled.length === 8, "An identical creation retry failed instead of replaying");
  const bookingIds = [...new Set(fulfilled.map((result) => result.booking.id))];
  assert(bookingIds.length === 1, `Identical retries created ${bookingIds.length} bookings`);
  assert(
    fulfilled.filter((result) => result.replayed === false).length === 1,
    "Identical retries did not produce exactly one original creation",
  );
  const bookingId = required(bookingIds[0], "Creation retry result did not contain a booking ID");
  registry.bookingIds.push(bookingId);
  const eventCounts = await eventSetCounts(
    bookingId,
    project.participantIds,
    "booking.created",
    "BOOKING_CONFIRMED",
    `${project.title} is booked`,
    BookingStatus.CONFIRMED,
  );
  assert(eventCounts.history === 1, "Create retry duplicated booking status history");
  assert(eventCounts.audit === 1, "Create retry duplicated booking audit history");
  assert(
    eventCounts.notifications === project.participantIds.length,
    "Create retry duplicated or omitted its participant notification set",
  );
  assert(
    eventCounts.deliveries === project.participantIds.length,
    "Create retry duplicated or omitted notification delivery records",
  );
  return {
    bookingId,
    result: {
      concurrentRequests: 8,
      uniqueBookings: 1,
      originalWrites: 1,
      createHistory: eventCounts.history,
      createAudit: eventCounts.audit,
      notificationRecipients: eventCounts.notifications,
    },
  };
}

async function verifyFutureLimitRace(slotIds: readonly [string, string], project: CreatedProject) {
  const settled = await Promise.allSettled(
    slotIds.map((slotId, index) =>
      create(
        project.leader,
        {
          labSlotId: slotId,
          projectId: project.id,
          participantIds: project.participantIds,
          idempotencyKey: crypto.randomUUID(),
        },
        requestContext(`future-limit-${index + 1}`),
      ),
    ),
  );
  const fulfilled = fulfilledResults(settled);
  const rejected = rejectedResults(settled);
  assert(fulfilled.length === 1, `Future limit race produced ${fulfilled.length} winners`);
  assert(rejected.length === 1, `Future limit race produced ${rejected.length} conflicts`);
  assert(
    errorCode(rejected[0]) === "PROJECT_BOOKING_LIMIT_REACHED",
    `Future limit loser returned ${errorCode(rejected[0]) ?? "no stable error code"}`,
  );
  const live = await prisma.booking.findMany({
    where: {
      projectId: project.id,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
    },
    select: { id: true },
  });
  assert(live.length === 1, `Future booking limit persisted ${live.length} live bookings`);
  registry.bookingIds.push(live[0]!.id);
  return { winners: 1, conflicts: 1, liveBookings: live.length, configuredLimit: 1 };
}

async function verifyCancellationAndCapacityRelease(
  slotId: string,
  cancelledProject: CreatedProject,
  replacementProject: CreatedProject,
) {
  const original = await create(
    cancelledProject.leader,
    {
      labSlotId: slotId,
      projectId: cancelledProject.id,
      participantIds: cancelledProject.participantIds,
      idempotencyKey: crypto.randomUUID(),
    },
    requestContext("cancellation-create"),
  );
  const bookingId = original.booking.id;
  registry.bookingIds.push(bookingId);
  const detailBefore = await get(bookingId, cancelledProject.leader);
  const upcomingBefore = await list(
    { scope: "upcoming", page: 1, limit: 100 },
    cancelledProject.leader,
  );
  assert(detailBefore.id === bookingId, "Leader could not view the confirmed booking detail");
  assert(
    upcomingBefore.data.some((booking) => booking.id === bookingId),
    "Confirmed booking was absent from the leader's upcoming list",
  );
  const cancellationKey = crypto.randomUUID();
  const reason = "Phase 4 concurrency verification cancellation";
  const settled = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) =>
      cancel(
        bookingId,
        reason,
        cancellationKey,
        cancelledProject.leader,
        requestContext(`cancel-retry-${index + 1}`),
      ),
    ),
  );
  const fulfilled = fulfilledResults(settled);
  assert(fulfilled.length === 6, "An identical cancellation retry failed instead of replaying");
  assert(
    fulfilled.filter((result) => result.replayed === false).length === 1,
    "Cancellation retries did not produce exactly one original transition",
  );
  const eventCounts = await eventSetCounts(
    bookingId,
    cancelledProject.participantIds,
    "booking.cancelled",
    "BOOKING_CANCELLED",
    `${cancelledProject.title} booking cancelled`,
    BookingStatus.CANCELLED,
  );
  assert(eventCounts.history === 1, "Cancellation retry duplicated cancellation history");
  assert(eventCounts.audit === 1, "Cancellation retry duplicated cancellation audit history");
  assert(
    eventCounts.notifications === cancelledProject.participantIds.length,
    "Cancellation retry duplicated or omitted its participant notification set",
  );
  assert(
    eventCounts.deliveries === cancelledProject.participantIds.length,
    "Cancellation retry duplicated or omitted cancellation delivery records",
  );
  const detailAfter = await get(bookingId, cancelledProject.leader);
  const [upcomingAfter, pastAfter] = await Promise.all([
    list({ scope: "upcoming", page: 1, limit: 100 }, cancelledProject.leader),
    list({ scope: "past", page: 1, limit: 100 }, cancelledProject.leader),
  ]);
  assert(detailAfter.status === BookingStatus.CANCELLED, "Cancelled detail did not persist state");
  assert(
    !upcomingAfter.data.some((booking) => booking.id === bookingId),
    "Cancelled booking remained in the leader's upcoming list",
  );
  assert(
    pastAfter.data.some((booking) => booking.id === bookingId),
    "Cancelled booking was absent from the leader's past list",
  );

  const replacement = await create(
    replacementProject.leader,
    {
      labSlotId: slotId,
      projectId: replacementProject.id,
      participantIds: replacementProject.participantIds,
      idempotencyKey: crypto.randomUUID(),
    },
    requestContext("capacity-replacement"),
  );
  registry.bookingIds.push(replacement.booking.id);
  const live = await liveBookingsForSlot(slotId);
  assert(live.count === 1 && live.occupancy === 4, "Cancellation did not release slot capacity");
  return {
    concurrentRetries: 6,
    cancellationWrites: 1,
    cancellationHistory: eventCounts.history,
    cancellationAudit: eventCounts.audit,
    notificationRecipients: eventCounts.notifications,
    leaderDetailAndLists: "confirmed-upcoming-to-cancelled-past",
    replacementConfirmed: true,
    occupancyAfterReplacement: live.occupancy,
  };
}

async function verifyHotSlotBurst(
  slotId: string,
  projects: CreatedProject[],
  expectedCapacity: number,
) {
  const burstStartedAt = Date.now();
  const settled = await Promise.allSettled(
    projects.map((project, index) =>
      create(
        project.leader,
        {
          labSlotId: slotId,
          projectId: project.id,
          participantIds: project.participantIds,
          idempotencyKey: crypto.randomUUID(),
        },
        requestContext(`hot-slot-${index + 1}`),
      ),
    ),
  );
  const elapsedMs = Date.now() - burstStartedAt;
  const fulfilled = fulfilledResults(settled);
  const rejected = rejectedResults(settled);
  const rejectionCodes = rejected.reduce<Record<string, number>>((counts, reason) => {
    const code = errorCode(reason) ?? "UNKNOWN";
    counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, {});
  assert(
    fulfilled.length === expectedCapacity,
    `Hot-slot burst confirmed ${fulfilled.length}, expected ${expectedCapacity}; rejection codes ${JSON.stringify(rejectionCodes)}`,
  );
  assert(
    rejected.length === projects.length - expectedCapacity,
    `Hot-slot burst returned ${rejected.length} conflicts, expected ${projects.length - expectedCapacity}`,
  );
  assert(
    rejected.every((reason) => errorCode(reason) === "SLOT_CAPACITY_EXCEEDED"),
    `Hot-slot burst returned unexpected errors: ${[
      ...new Set(rejected.map((reason) => errorCode(reason) ?? "UNKNOWN")),
    ].join(", ")}`,
  );
  const live = await liveBookingsForSlot(slotId);
  assert(live.count === expectedCapacity, "Hot-slot booking count does not equal capacity");
  assert(live.occupancy === expectedCapacity, "Hot-slot summed occupancy does not equal capacity");
  registry.bookingIds.push(...live.ids);
  return {
    requests: projects.length,
    confirmed: fulfilled.length,
    conflicts: rejected.length,
    occupancy: live.occupancy,
    capacity: expectedCapacity,
    rejectionCodes,
    elapsedMs,
  };
}

async function verifySnapshotImmutability(
  labId: string,
  bookingId: string,
  project: CreatedProject,
  users: CreatedUser[],
) {
  const before = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { participants: { orderBy: { userId: "asc" } } },
  });
  const immutableBefore = snapshotProjection(before);
  await prisma.project.update({
    where: { id: project.id },
    data: { title: `${prefix} mutated project title` },
  });
  await prisma.lab.update({
    where: { id: labId },
    data: { name: `${prefix} mutated MakerSpace`, cancellationWindowHours: 12 },
  });
  await Promise.all(
    users.map((user, index) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: `${prefix} mutated student ${index + 1}`,
          email: `${prefix}-mutated-${index + 1}@mitwpu.edu.in`,
        },
      }),
    ),
  );
  const after = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { participants: { orderBy: { userId: "asc" } } },
  });
  assert(
    JSON.stringify(snapshotProjection(after)) === JSON.stringify(immutableBefore),
    "Booking snapshots changed after mutable Lab/project/user edits",
  );
  return {
    labNamePreserved: true,
    projectTitlePreserved: true,
    participantIdentityPreserved: users.length,
    cancellationPolicyPreserved: true,
  };
}

async function verifyRemovedArtifacts(bookingId: string) {
  const [relations] = await prisma.$queryRaw<
    Array<{ booking_equipment: string | null; booking_consumables: string | null }>
  >`
    SELECT
      to_regclass('public.booking_equipment')::text AS booking_equipment,
      to_regclass('public.booking_consumables')::text AS booking_consumables
  `;
  const qrColumns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('bookings', 'quick_visits')
      AND column_name IN ('qr_token_hash', 'qr_expires_at')
  `;
  // `booking_equipment` is back, deliberately: a team now holds machines for a
  // specific slot, and those holds are released when the booking stops being
  // live. Consumables remain a project-level expectation with no per-slot
  // reservation, so that table must stay absent.
  assert(relations?.booking_equipment !== null, "booking_equipment table is missing");
  assert(relations?.booking_consumables === null, "booking_consumables still exists");
  assert(qrColumns.length === 0, "Booking or Quick Visit QR columns still exist");
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assert(
    !("qrTokenHash" in booking) && !("qrExpiresAt" in booking),
    "QR fields leaked into Prisma",
  );
  return { bookingEquipmentTable: true, bookingConsumablesTable: false, qrColumns: 0 };
}

async function eventSetCounts(
  bookingId: string,
  participantIds: string[],
  auditAction: string,
  notificationType: string,
  notificationTitle: string,
  historyStatus: BookingStatus,
) {
  const notifications = await prisma.notification.findMany({
    where: {
      userId: { in: participantIds },
      type: notificationType,
      title: notificationTitle,
    },
    select: { id: true, userId: true },
  });
  assert(
    new Set(notifications.map((notification) => notification.userId)).size === notifications.length,
    `${notificationType} contains duplicate recipients`,
  );
  const [history, audit, deliveries] = await Promise.all([
    prisma.bookingStatusHistory.count({ where: { bookingId, toStatus: historyStatus } }),
    prisma.auditLog.count({ where: { entityId: bookingId, action: auditAction } }),
    prisma.notificationDelivery.count({
      where: { notificationId: { in: notifications.map((notification) => notification.id) } },
    }),
  ]);
  return { history, audit, notifications: notifications.length, deliveries };
}

async function liveBookingsForSlot(slotId: string) {
  const rows = await prisma.booking.findMany({
    where: { labSlotId: slotId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] } },
    select: { id: true, attendeeCount: true },
  });
  return {
    ids: rows.map((booking) => booking.id),
    count: rows.length,
    occupancy: rows.reduce((sum, booking) => sum + booking.attendeeCount, 0),
  };
}

async function cleanupFixtures(target: FixtureRegistry) {
  const discoveredLabs = await prisma.lab.findMany({
    where: { OR: [{ id: { in: target.labIds } }, { code: { startsWith: "P4L" + runToken } }] },
    select: { id: true },
  });
  const labIds = unique([...target.labIds, ...discoveredLabs.map((row) => row.id)]);
  const discoveredUsers = await prisma.user.findMany({
    where: { OR: [{ id: { in: target.userIds } }, { email: { startsWith: `${prefix}-` } }] },
    select: { id: true },
  });
  const userIds = unique([...target.userIds, ...discoveredUsers.map((row) => row.id)]);
  const discoveredProjects = await prisma.project.findMany({
    where: {
      OR: [
        { id: { in: target.projectIds } },
        { title: { startsWith: prefix } },
        ...(labIds.length ? [{ labId: { in: labIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const projectIds = unique([...target.projectIds, ...discoveredProjects.map((row) => row.id)]);
  const discoveredBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { id: { in: target.bookingIds } },
        ...(labIds.length ? [{ labId: { in: labIds } }] : []),
        ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
        ...(userIds.length ? [{ createdById: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const bookingIds = unique([...target.bookingIds, ...discoveredBookings.map((row) => row.id)]);
  const notifications = userIds.length
    ? await prisma.notification.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    : [];
  const notificationIds = notifications.map((row) => row.id);

  if (notificationIds.length) {
    await prisma.notificationDelivery.deleteMany({
      where: { notificationId: { in: notificationIds } },
    });
    await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
  }
  if (userIds.length || bookingIds.length || projectIds.length) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          ...(userIds.length ? [{ actorUserId: { in: userIds } }] : []),
          ...([...bookingIds, ...projectIds].length
            ? [{ entityId: { in: [...bookingIds, ...projectIds] } }]
            : []),
        ],
      },
    });
  }
  if (bookingIds.length || userIds.length || labIds.length) {
    await prisma.visit.deleteMany({
      where: {
        OR: [
          ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
          ...(userIds.length ? [{ userId: { in: userIds } }] : []),
          ...(labIds.length ? [{ labId: { in: labIds } }] : []),
        ],
      },
    });
  }
  if (bookingIds.length) {
    await prisma.bookingEquipment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }
  if (labIds.length || userIds.length) {
    await prisma.quickVisit.deleteMany({
      where: {
        OR: [
          ...(labIds.length ? [{ labId: { in: labIds } }] : []),
          ...(userIds.length ? [{ userId: { in: userIds } }] : []),
        ],
      },
    });
  }
  if (projectIds.length) {
    await prisma.mentorRequest.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectEquipmentRequirement.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.projectConsumableRequirement.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (labIds.length) {
    await prisma.labSlot.deleteMany({ where: { labId: { in: labIds } } });
    await prisma.labDateException.deleteMany({ where: { labId: { in: labIds } } });
    await prisma.labSchedule.deleteMany({ where: { labId: { in: labIds } } });
    await prisma.lab.deleteMany({ where: { id: { in: labIds } } });
  }
  if (userIds.length) {
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userProvisioning.deleteMany({
      where: { OR: [{ claimedById: { in: userIds } }, { email: { startsWith: `${prefix}-` } }] },
    });
    await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (target.programmeIds.length) {
    await prisma.programme.deleteMany({ where: { id: { in: target.programmeIds } } });
  }
  if (target.departmentIds.length) {
    await prisma.department.deleteMany({ where: { id: { in: target.departmentIds } } });
  }

  const [labsLeft, usersLeft, projectsLeft, bookingsLeft, notificationsLeft, auditsLeft] =
    await Promise.all([
      labIds.length ? prisma.lab.count({ where: { id: { in: labIds } } }) : 0,
      userIds.length ? prisma.user.count({ where: { id: { in: userIds } } }) : 0,
      projectIds.length ? prisma.project.count({ where: { id: { in: projectIds } } }) : 0,
      bookingIds.length ? prisma.booking.count({ where: { id: { in: bookingIds } } }) : 0,
      userIds.length ? prisma.notification.count({ where: { userId: { in: userIds } } }) : 0,
      userIds.length ? prisma.auditLog.count({ where: { actorUserId: { in: userIds } } }) : 0,
    ]);
  assert(
    labsLeft + usersLeft + projectsLeft + bookingsLeft + notificationsLeft + auditsLeft === 0,
    `Cleanup left fixture rows: ${JSON.stringify({
      labsLeft,
      usersLeft,
      projectsLeft,
      bookingsLeft,
      notificationsLeft,
      auditsLeft,
    })}`,
  );
}

function viewerFor(user: CreatedUser): Viewer {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: [UserRole.STUDENT],
    profileComplete: true,
    isActive: true,
    sessionId: `${prefix}-session-${user.id}`,
  };
}

function requestContext(label: string) {
  return {
    requestId: `${prefix}-${label}`,
    ipAddress: "127.0.0.1",
    userAgent: "phase4-postgresql-verification",
  };
}

function snapshotProjection(booking: {
  labNameSnapshot: string;
  projectTitleSnapshot: string;
  slotStartsAtSnapshot: Date;
  slotEndsAtSnapshot: Date;
  timeZoneSnapshot: string;
  cancellationWindowHoursSnapshot: number;
  participants: Array<{
    userId: string;
    nameSnapshot: string;
    emailSnapshot: string;
    prnSnapshot: string | null;
    projectRoleSnapshot: ProjectMemberRole;
  }>;
}) {
  return {
    labNameSnapshot: booking.labNameSnapshot,
    projectTitleSnapshot: booking.projectTitleSnapshot,
    slotStartsAtSnapshot: booking.slotStartsAtSnapshot.toISOString(),
    slotEndsAtSnapshot: booking.slotEndsAtSnapshot.toISOString(),
    timeZoneSnapshot: booking.timeZoneSnapshot,
    cancellationWindowHoursSnapshot: booking.cancellationWindowHoursSnapshot,
    participants: booking.participants.map((participant) => ({
      userId: participant.userId,
      nameSnapshot: participant.nameSnapshot,
      emailSnapshot: participant.emailSnapshot,
      prnSnapshot: participant.prnSnapshot,
      projectRoleSnapshot: participant.projectRoleSnapshot,
    })),
  };
}

function localDateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

function hoursAfter(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function fulfilledResults<T>(settled: PromiseSettledResult<T>[]) {
  return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

function rejectedResults<T>(settled: PromiseSettledResult<T>[]) {
  return settled.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer between ${minimum} and ${maximum}, received ${value}`);
  }
  return parsed;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  })
  .catch((error) => {
    process.exitCode = 1;
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: errorMessage(error), elapsedMs: Date.now() - startedAt })}\n`,
    );
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
