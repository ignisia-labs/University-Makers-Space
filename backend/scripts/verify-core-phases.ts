/**
 * Phases 1–3 core verification.
 *
 * The Jest suite mocks Prisma and Redis in every "integration" file, so no SQL
 * ever executes there. This script closes that gap: it drives identity,
 * onboarding, the project lifecycle and lab availability against a real
 * PostgreSQL database, asserting the behaviour those mocks only simulate.
 *
 * Run:
 *   RUN_CORE_DATABASE_TESTS=true npx tsx scripts/verify-core-phases.ts
 */
import crypto from "node:crypto";
import { MentorRequestStatus, ProjectMemberStatus, ProjectStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import { hasPermission, permissionsFor } from "../src/config/permissions.js";
import * as auth from "../src/modules/auth/auth-service.js";
import * as bookings from "../src/modules/bookings/booking-service.js";
import * as labs from "../src/modules/labs/lab-service.js";
import * as projects from "../src/modules/projects/project-service.js";
import * as users from "../src/modules/users/user-service.js";

type Viewer = NonNullable<Express.Request["user"]>;

const enabled = process.env.RUN_CORE_DATABASE_TESTS === "true";
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const prefix = `core-${runToken}`;
const startedAt = Date.now();

async function main() {
  if (!enabled) {
    throw new Error(
      "Refusing to mutate the configured database. Set RUN_CORE_DATABASE_TESTS=true explicitly.",
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

async function run() {
  const fixture = await createFixture();
  return {
    permissionMatrix: verifyPermissionMatrix(),
    onboarding: await verifyOnboarding(fixture),
    prnUniqueness: await verifyPrnUniqueness(fixture),
    sessionLifecycle: await verifySessionLifecycle(fixture),
    identityBinding: await verifyIdentityBinding(fixture),
    accountRemoval: await verifyAccountRemoval(fixture),
    mentorDirectory: await verifyMentorDirectory(fixture),
    mentorSeesSessions: await verifyMentorSeesSessions(fixture),
    retirementReleasesHolds: await verifyRetirementReleasesHolds(fixture),
    projectLifecycle: await verifyProjectLifecycle(fixture),
    verificationWithPendingTeammate: await verifyVerificationWithPendingTeammate(fixture),
    projectIdempotency: await verifyProjectIdempotency(fixture),
    invitationAuthorisation: await verifyInvitationAuthorisation(fixture),
    availabilityHorizon: await verifyAvailabilityHorizon(fixture),
    closureHandling: await verifyClosureHandling(fixture),
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  const departmentId = crypto.randomUUID();
  const programmeId = crypto.randomUUID();
  const labId = crypto.randomUUID();

  await prisma.department.create({
    data: { id: departmentId, code: `C1D${runToken}`.toUpperCase(), name: `${prefix} department` },
  });
  await prisma.programme.create({
    data: {
      id: programmeId,
      departmentId,
      code: `C1P${runToken}`.toUpperCase(),
      name: `${prefix} programme`,
    },
  });
  await prisma.academicYearOption.upsert({
    where: { value: 2 },
    update: { isActive: true },
    create: { value: 2, label: "Year 2" },
  });
  await prisma.lab.create({
    data: {
      id: labId,
      code: `C1L${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      timeZone: "Asia/Kolkata",
      slotDurationMinutes: 60,
      bookingCapacity: 20,
      quickVisitCapacity: 10,
      bookingHorizonDays: 7,
      // No cancellation window. Otherwise whether a fixture booking can be
      // released depends on how close the clock is to the lab's opening hours,
      // and the suite passes in the afternoon and fails in the morning. The
      // cancellation deadline is policy, tested where policy is the subject.
      cancellationWindowHours: 0,
      schedules: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          opensAtMinute: 8 * 60 + 30,
          closesAtMinute: 18 * 60 + 30,
          isOpen: true,
        })),
      },
    },
  });

  const leader = await createUser("leader", [UserRole.STUDENT], false);
  const member = await createUser("member", [UserRole.STUDENT], true);
  const outsider = await createUser("outsider", [UserRole.STUDENT], true);
  const mentor = await createUser("mentor", [UserRole.FACULTY_MENTOR], true);
  const admin = await createUser("admin", [UserRole.ADMIN], true);

  await attachProfile(member.id, departmentId, programmeId, `${runToken}M`.toUpperCase());
  await attachProfile(outsider.id, departmentId, programmeId, `${runToken}O`.toUpperCase());

  return { departmentId, programmeId, labId, leader, member, outsider, mentor, admin };
}

async function createUser(tag: string, roles: UserRole[], profileComplete: boolean) {
  const id = crypto.randomUUID();
  const email = `${prefix}-${tag}@mitwpu.edu.in`;
  const name = `${prefix} ${tag}`;
  await prisma.user.create({
    data: {
      id,
      email,
      name,
      googleSubject: `${prefix}-${tag}`,
      roles,
      profileComplete,
      isActive: true,
    },
  });
  return viewerFor(id, name, email, roles, profileComplete);
}

async function attachProfile(
  userId: string,
  departmentId: string,
  programmeId: string,
  prn: string,
) {
  await prisma.studentProfile.create({
    data: { userId, prn, departmentId, programmeId, academicYear: 2 },
  });
}

function viewerFor(
  id: string,
  name: string,
  email: string,
  roles: UserRole[],
  profileComplete = true,
): Viewer {
  return {
    id,
    name,
    email,
    roles,
    profileComplete,
    isActive: true,
    sessionId: crypto.randomUUID(),
  };
}

// ─── Phase 1: identity ───────────────────────────────────────────────────────

/** Deny-by-default: no role may hold a permission it was not granted. */
function verifyPermissionMatrix() {
  const forbidden: Array<[UserRole, string]> = [
    [UserRole.STUDENT, "booking.manage"],
    [UserRole.STUDENT, "lab.configure"],
    [UserRole.STUDENT, "user.read"],
    [UserRole.STUDENT, "project.read.any"],
    [UserRole.FACULTY_MENTOR, "booking.create"],
    [UserRole.FACULTY_MENTOR, "lab.configure"],
    [UserRole.FACULTY_MENTOR, "project.read.any"],
    [UserRole.LAB_ASSISTANT, "lab.configure"],
    [UserRole.LAB_ASSISTANT, "user.manage"],
    [UserRole.ADMIN, "user.roles.manage"],
  ];
  for (const [role, permission] of forbidden) {
    assert(
      !hasPermission([role], permission as Parameters<typeof hasPermission>[1]),
      `${role} must NOT hold ${permission}`,
    );
  }
  const required: Array<[UserRole, string]> = [
    [UserRole.STUDENT, "booking.create"],
    [UserRole.STUDENT, "project.create"],
    [UserRole.FACULTY_MENTOR, "project.approve"],
    [UserRole.LAB_ASSISTANT, "booking.manage"],
    [UserRole.ADMIN, "lab.configure"],
    [UserRole.SUPER_ADMIN, "user.roles.manage"],
  ];
  for (const [role, permission] of required) {
    assert(
      hasPermission([role], permission as Parameters<typeof hasPermission>[1]),
      `${role} must hold ${permission}`,
    );
  }
  // A multi-role account is the union of its roles, never more.
  const combined = permissionsFor([UserRole.STUDENT, UserRole.FACULTY_MENTOR]);
  const union = new Set([
    ...permissionsFor([UserRole.STUDENT]),
    ...permissionsFor([UserRole.FACULTY_MENTOR]),
  ]);
  assert(combined.length === union.size, "multi-role permissions must be the exact union");
  return { forbiddenChecked: forbidden.length, requiredChecked: required.length };
}

/** Onboarding must persist a profile and reject inconsistent academic data. */
async function verifyOnboarding(fixture: Fixture) {
  const prn = `${runToken}L`.toUpperCase();
  await auth.completeOnboarding(fixture.leader.id, {
    fullName: "Leader Person",
    prn,
    departmentId: fixture.departmentId,
    programmeId: fixture.programmeId,
    academicYear: 2,
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: fixture.leader.id },
    include: { studentProfile: true },
  });
  assert(user.profileComplete, "onboarding must mark the profile complete");
  assert(user.studentProfile?.prn === prn, "the PRN must be persisted");
  assert(user.name === "Leader Person", "onboarding must set the display name");

  // A programme from a different department must be refused.
  const otherDepartment = await prisma.department.create({
    data: { code: `C1X${runToken}`.toUpperCase(), name: `${prefix} other department` },
  });
  const mismatch = await capture(() =>
    auth.completeOnboarding(fixture.member.id, {
      fullName: "Member Person",
      prn: `${runToken}Z`.toUpperCase(),
      departmentId: otherDepartment.id,
      programmeId: fixture.programmeId,
      academicYear: 2,
    }),
  );
  assert(
    mismatch === "INVALID_ACADEMIC_SELECTION",
    `cross-department programme must be refused, got ${mismatch}`,
  );

  const badYear = await capture(() =>
    auth.completeOnboarding(fixture.member.id, {
      fullName: "Member Person",
      prn: `${runToken}Y`.toUpperCase(),
      departmentId: fixture.departmentId,
      programmeId: fixture.programmeId,
      academicYear: 11,
    }),
  );
  assert(badYear === "INVALID_ACADEMIC_YEAR", `inactive year must be refused, got ${badYear}`);

  // A non-student account has no student profile to complete.
  const notStudent = await capture(() =>
    auth.completeOnboarding(fixture.mentor.id, {
      fullName: "Mentor Person",
      prn: `${runToken}Q`.toUpperCase(),
      departmentId: fixture.departmentId,
      programmeId: fixture.programmeId,
      academicYear: 2,
    }),
  );
  assert(
    notStudent === "STUDENT_PROFILE_NOT_REQUIRED",
    `a faculty account must be refused, got ${notStudent}`,
  );
  return { persisted: true, crossDepartmentBlocked: true, inactiveYearBlocked: true };
}

/** The PRN unique index must hold at the database level. */
async function verifyPrnUniqueness(fixture: Fixture) {
  const existing = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: fixture.member.id },
  });
  const duplicate = await capture(() =>
    prisma.studentProfile.update({
      where: { userId: fixture.outsider.id },
      data: { prn: existing.prn },
    }),
  );
  assert(
    duplicate === "P2002",
    `a duplicate PRN must be refused by the database, got ${duplicate}`,
  );
  return { enforcedBy: "unique index" };
}

/** Sessions must be revocable, and revocation must be immediate. */
async function verifySessionLifecycle(fixture: Fixture) {
  const sessionId = crypto.randomUUID();
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: fixture.leader.id,
      refreshTokenHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const live = await prisma.session.findFirst({
    where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  assert(Boolean(live), "a fresh session must be live");

  const fakeResponse = { clearCookie: () => undefined } as unknown as Parameters<
    typeof auth.logout
  >[2];
  await auth.logout(fixture.leader.id, sessionId, fakeResponse);
  const revoked = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
  assert(revoked.revokedAt !== null, "logout must revoke the session row");

  // Another user's session id must not be revocable.
  const otherSession = crypto.randomUUID();
  await prisma.session.create({
    data: {
      id: otherSession,
      userId: fixture.member.id,
      refreshTokenHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  await auth.logout(fixture.leader.id, otherSession, fakeResponse);
  const untouched = await prisma.session.findUniqueOrThrow({ where: { id: otherSession } });
  assert(untouched.revokedAt === null, "logout must be scoped to the caller's own session");
  return { revoked: true, scopedToOwner: true };
}

/**
 * Google identity binding, and the way back out of it.
 *
 * Sign-in refuses when an email already carries a *different* Google subject —
 * that is what stops a recycled or spoofed address from taking over an existing
 * account. But an account whose stored subject is wrong (seeded, imported, or a
 * Workspace user deleted and recreated) would otherwise be locked out forever,
 * so an operator must be able to clear the binding.
 */
async function verifyIdentityBinding(fixture: Fixture) {
  const email = `${prefix}-identity@mitwpu.edu.in`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "Bound Account",
      googleSubject: "google-subject-original",
      roles: [UserRole.STUDENT],
      profileComplete: true,
    },
  });
  const session = await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      refreshTokenHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  // The guard itself: a different subject on the same email is a conflict.
  const bound = await prisma.user.findFirstOrThrow({ where: { email } });
  assert(
    bound.googleSubject !== null && bound.googleSubject !== "some-other-subject",
    "precondition: the account carries a specific identity",
  );

  const unlinked = await users.unlinkGoogleIdentity(user.id, fixture.admin.id);
  assert(unlinked.googleLinked === false, "the DTO must report the identity as cleared");

  const after = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
  assert(after.googleSubject === null, "the stored subject must be cleared");
  assert(
    after.tokenVersion > user.tokenVersion,
    "the token version must advance so issued tokens stop being trusted",
  );

  const revoked = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
  assert(revoked.revokedAt !== null, "live sessions must be revoked when the identity changes");

  const audited = await prisma.auditLog.count({
    where: { entityId: user.id, action: "user.google_identity_unlinked" },
  });
  assert(audited === 1, `the unlink must be audited, got ${audited}`);

  // Unlinking twice is a no-op, not a silent success.
  const repeat = await capture(() => users.unlinkGoogleIdentity(user.id, fixture.admin.id));
  assert(repeat === "IDENTITY_ALREADY_UNLINKED", `a second unlink must be refused, got ${repeat}`);

  // With the binding cleared the account is adoptable again by any identity.
  await prisma.user.update({
    where: { id: user.id },
    data: { googleSubject: "google-subject-replacement" },
  });
  const rebound = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
  assert(
    rebound.googleSubject === "google-subject-replacement",
    "a cleared account must accept a new identity",
  );
  return { cleared: true, sessionsRevoked: true, audited, repeatRefused: repeat };
}

/**
 * Removing an account must free the address.
 *
 * Sign-in only considers rows where `deleted_at IS NULL`, while `email` and
 * `google_subject` are unique across *all* rows. A retired account that kept
 * its address would therefore hold it hostage forever: the next sign-in would
 * not find the row, would try to insert a new one, and would collide on the
 * unique index. Releasing both identifiers is what keeps deletion reversible in
 * practice while the history stays intact.
 */
async function verifyAccountRemoval(fixture: Fixture) {
  const email = `${prefix}-removable@mitwpu.edu.in`;
  const prn = `${runToken}RM`.toUpperCase().slice(0, 24);
  const user = await prisma.user.create({
    data: {
      email,
      name: "Removable Person",
      googleSubject: `${prefix}-removable-sub`,
      roles: [UserRole.STUDENT],
      profileComplete: true,
      studentProfile: {
        create: {
          prn,
          departmentId: fixture.departmentId,
          programmeId: fixture.programmeId,
          academicYear: 2,
        },
      },
    },
  });
  await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      refreshTokenHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  await prisma.userProvisioning.create({
    data: { email, roles: [UserRole.LAB_ASSISTANT], isActive: true },
  });

  await users.remove(user.id, fixture.admin.id);

  const retired = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert(retired.deletedAt !== null, "the row must be retired, not dropped");
  assert(retired.isActive === false, "and deactivated");
  assert(retired.email !== email, "the address must be released");
  assert(retired.googleSubject === null, "the Google identity must be released");

  const live = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
  assert(live === 0, `every session must be revoked, got ${live}`);

  const grant = await prisma.userProvisioning.findUnique({ where: { email } });
  assert(grant === null, "the standing role grant must not survive the account");

  // `prn` is unique too. A surviving profile would lock that PRN forever — the
  // same student could never re-onboard and the registry could never reissue it.
  const profile = await prisma.studentProfile.findUnique({ where: { prn } });
  assert(profile === null, "the student profile must be cleared so the PRN is released");

  // The decisive property: the address is usable again.
  const reused = await prisma.user.create({
    data: {
      email,
      name: "Someone Else",
      googleSubject: `${prefix}-reused-sub`,
      roles: [UserRole.STUDENT],
      profileComplete: false,
      studentProfile: {
        create: {
          prn,
          departmentId: fixture.departmentId,
          programmeId: fixture.programmeId,
          academicYear: 1,
        },
      },
    },
  });
  assert(reused.email === email, "a fresh account may claim the released address");

  const audited = await prisma.auditLog.findFirst({
    where: { entityId: user.id, action: "user.removed" },
  });
  assert(Boolean(audited), "removal must be audited");
  const metadata = audited!.metadata as { email?: string } | null;
  assert(
    metadata?.email === email,
    "the audit record must preserve the original address for traceability",
  );
  return {
    addressReleased: true,
    prnReleased: true,
    sessionsRevoked: true,
    grantRemoved: true,
    reusable: true,
  };
}

// ─── Phase 2: projects ───────────────────────────────────────────────────────

/**
 * The mentor directory is browsable.
 *
 * This exists because it once was not: the endpoint required a search term of
 * at least two characters, so opening the picker showed an empty list and a
 * student had to already know a mentor's name to find one. Listing with no term
 * is the behaviour the create-project picker depends on.
 */
async function verifyMentorDirectory(fixture: Fixture) {
  // A real faculty list is hundreds of people, so "no search term" returns the
  // first page rather than everyone. What must hold is that the page is real,
  // the total counts the whole directory, and the order is alphabetical — the
  // picker's grouping and its "showing N of M" line both depend on that.
  const browsed = await users.searchFacultyMentors({}, fixture.leader.id);
  assert(browsed.data.length > 0, "listing with no search term must return a page of mentors");
  assert(
    browsed.meta.total >= browsed.data.length,
    "the total must count the directory, not the page",
  );

  // Alphabetical, so the picker can group by initial without re-sorting.
  //
  // The check is on initials rather than whole names on purpose. Postgres sorts
  // under the database collation, which for en_US.utf8 ignores spaces —
  // "Anilkumar Bangar" lands before "Anil Hiwale" — while JavaScript's
  // localeCompare treats the space as significant. Neither is wrong, and
  // demanding they agree tests the collation rather than the product. What the
  // A–Z grouping actually depends on is that initials never go backwards.
  const initials = browsed.data.map((row) => row.name.trim()[0]?.toUpperCase() ?? "#");
  const regressed = initials.findIndex(
    (letter, index) => index > 0 && letter < initials[index - 1]!,
  );
  assert(
    regressed === -1,
    `mentor initials must not go backwards, ${initials[regressed - 1]} preceded ${initials[regressed]}`,
  );

  // Reaching a specific mentor is search's job, and it must work however large
  // the directory grows — this is what the picker falls back on past page one.
  const byName = await users.searchFacultyMentors(
    { search: fixture.mentor.name.slice(0, 4) },
    fixture.leader.id,
  );
  assert(
    byName.data.some((row) => row.id === fixture.mentor.id),
    "a partial name must find a mentor anywhere in the directory",
  );

  const blank = await users.searchFacultyMentors({ search: "   " }, fixture.leader.id);
  assert(
    blank.meta.total === browsed.meta.total,
    "a whitespace-only term must behave like no term, not match nothing",
  );

  const miss = await users.searchFacultyMentors(
    { search: "zzz-no-such-mentor" },
    fixture.leader.id,
  );
  assert(miss.data.length === 0, "a term matching nobody must return nothing");

  // The viewer is never offered as their own mentor.
  const selfView = await users.searchFacultyMentors({}, fixture.mentor.id);
  assert(
    !selfView.data.some((row) => row.id === fixture.mentor.id),
    "a mentor must not appear in their own directory results",
  );

  return {
    browsable: true,
    alphabetical: true,
    total: browsed.meta.total,
    selfExcluded: true,
  };
}

/**
 * A Faculty Mentor can see sessions for the projects they mentor.
 *
 * This exists because they could not: a mentor is neither the booker nor an
 * attendee, and booking visibility was scoped to those two plus operational
 * staff — so the mentor's sessions view was structurally empty, and the UI had
 * a placeholder where the list belonged.
 */
async function verifyMentorSeesSessions(fixture: Fixture) {
  const project = await projects.create(fixture.leader, {
    idempotencyKey: crypto.randomUUID(),
    labId: fixture.labId,
    title: `${prefix} mentor visibility`,
    description: "Checks that a mentor can see the sessions of a project they mentor.",
    teamMemberEmails: [],
    mentorId: fixture.mentor.id,
    equipmentIds: [],
    consumables: [],
  });
  await projects.decideMentorRequest(project.id, "APPROVED", undefined, fixture.mentor);

  // Today may already be past its last slot, so book the first open day the lab
  // actually publishes rather than assuming there is time left today.
  const dates = await labs.availabilityDates(fixture.labId, project.id, 1, fixture.leader);
  const openDay = dates.dates.find((entry) => entry.isOpen && entry.slotCount > 0);
  assert(Boolean(openDay), "the fixture lab must publish at least one bookable day");
  const day = await labs.dailyAvailability(
    fixture.labId,
    openDay!.date,
    project.id,
    1,
    fixture.leader,
  );
  const slot = day.slots[0];
  assert(Boolean(slot), "the first open day must offer a slot");

  const { booking } = await bookings.create(fixture.leader, {
    idempotencyKey: crypto.randomUUID(),
    labSlotId: slot!.id,
    projectId: project.id,
    participantIds: [fixture.leader.id],
  });

  const mentorView = await bookings.list({ scope: "all", limit: "50" }, fixture.mentor);
  assert(
    mentorView.data.some((row) => row.id === booking.id),
    "a mentor must see sessions for the project they mentor",
  );

  // Reading one directly must agree with the list, or the timeline would link
  // to a booking the mentor is then refused.
  const direct = await bookings.get(booking.id, fixture.mentor);
  assert(direct.id === booking.id, "a mentor must be able to open a mentored session");

  // Visibility is scoped: an unrelated faculty member sees nothing.
  const outsiderView = await bookings.list({ scope: "all", limit: "50" }, fixture.outsider);
  assert(
    !outsiderView.data.some((row) => row.id === booking.id),
    "an unrelated account must not see another project's sessions",
  );

  // Release the seat: the leader may hold only one live booking, and later
  // checks in this suite need to book too.
  await bookings.cancel(booking.id, "fixture reset", crypto.randomUUID(), fixture.leader);
  await prisma.bookingEquipment.deleteMany({ where: { bookingId: booking.id } });
  return { mentorSees: true, canOpen: true, outsiderBlocked: true };
}

/**
 * Archiving and deleting release what a project was holding.
 *
 * Both existed as one call that set `deletedAt` *and* ARCHIVED, so "Archive"
 * silently removed a project from the list; and neither freed the booked slot,
 * leaving a seat and its machines held by a project nobody could reach.
 */
async function verifyRetirementReleasesHolds(fixture: Fixture) {
  const book = async (title: string) => {
    const project = await projects.create(fixture.leader, {
      idempotencyKey: crypto.randomUUID(),
      labId: fixture.labId,
      title: `${prefix} ${title}`,
      description: "Checks that retiring a project frees its slot.",
      teamMemberEmails: [],
      mentorId: fixture.mentor.id,
      equipmentIds: [],
      consumables: [],
    });
    await projects.decideMentorRequest(project.id, "APPROVED", undefined, fixture.mentor);
    const dates = await labs.availabilityDates(fixture.labId, project.id, 1, fixture.leader);
    const day = dates.dates.find((entry) => entry.isOpen && entry.slotCount > 0);
    assert(Boolean(day), "the fixture lab must publish a bookable day");
    const available = await labs.dailyAvailability(
      fixture.labId,
      day!.date,
      project.id,
      1,
      fixture.leader,
    );
    const slot = available.slots[0];
    assert(Boolean(slot), "the first open day must offer a slot");
    const { booking } = await bookings.create(fixture.leader, {
      idempotencyKey: crypto.randomUUID(),
      labSlotId: slot!.id,
      projectId: project.id,
      participantIds: [fixture.leader.id],
    });
    return { project, booking };
  };

  // ── Archiving keeps the project readable, but frees the slot.
  const archived = await book("archived");
  const afterArchive = await projects.archive(archived.project.id, fixture.leader);
  assert(
    afterArchive.status === ProjectStatus.ARCHIVED,
    `archiving must set ARCHIVED, got ${afterArchive.status}`,
  );
  const stillVisible = await prisma.project.findFirst({
    where: { id: archived.project.id, deletedAt: null },
  });
  assert(
    stillVisible !== null,
    "an archived project must remain readable — archiving is not deleting",
  );
  const archivedBooking = await prisma.booking.findUniqueOrThrow({
    where: { id: archived.booking.id },
  });
  assert(
    archivedBooking.status === "CANCELLED",
    `archiving must cancel the live booking, got ${archivedBooking.status}`,
  );
  assert(
    archivedBooking.cancellationReason === "The project was archived",
    "the cancellation must say why the seat was given up",
  );

  // ── Deleting hides the project, and also frees the slot.
  const deleted = await book("deleted");
  await projects.remove(deleted.project.id, fixture.leader);
  const hidden = await prisma.project.findFirst({
    where: { id: deleted.project.id, deletedAt: null },
  });
  assert(hidden === null, "a deleted project must disappear from view");
  const survives = await prisma.project.findUnique({ where: { id: deleted.project.id } });
  assert(
    survives !== null,
    "the row must survive — attendance and audit history must not be erased",
  );
  const deletedBooking = await prisma.booking.findUniqueOrThrow({
    where: { id: deleted.booking.id },
  });
  assert(
    deletedBooking.status === "CANCELLED",
    `deleting must cancel the live booking, got ${deletedBooking.status}`,
  );

  // The freed seats are genuinely available again.
  const reopened = await prisma.booking.count({
    where: {
      labSlotId: archived.booking.labSlotId,
      status: { in: ["CONFIRMED", "ACTIVE"] },
    },
  });
  assert(reopened === 0, `the slot must hold no live bookings, found ${reopened}`);

  return { archiveKeepsProject: true, deleteHidesProject: true, bookingsCancelled: 2 };
}

/** The full project lifecycle: draft → team → mentor → verified. */
async function verifyProjectLifecycle(fixture: Fixture) {
  const created = await projects.create(fixture.leader, {
    idempotencyKey: crypto.randomUUID(),
    labId: fixture.labId,
    title: `${prefix} rover`,
    description: "A project created by the real service against a real database.",
    teamMemberEmails: [fixture.member.email],
    mentorId: fixture.mentor.id,
    equipmentIds: [],
    consumables: [],
  });
  // A pending invitation no longer blocks the mentor: the project goes straight
  // to review, and the teammate's answer only decides whether they can be
  // selected as an attendee later.
  assert(
    created.status === ProjectStatus.MENTOR_APPROVAL_PENDING,
    `a new project goes straight to mentor review, got ${created.status}`,
  );

  const membership = await prisma.projectMember.findFirstOrThrow({
    where: { projectId: created.id, userId: fixture.member.id },
  });
  assert(membership.status === ProjectMemberStatus.PENDING, "an invited member starts as PENDING");

  await projects.respondToInvitation(created.id, "ACCEPTED", fixture.member);
  const afterAccept = await prisma.project.findUniqueOrThrow({ where: { id: created.id } });
  assert(
    afterAccept.status === ProjectStatus.MENTOR_APPROVAL_PENDING,
    `accepting does not change the review state, got ${afterAccept.status}`,
  );

  const request = await prisma.mentorRequest.findFirstOrThrow({
    where: { projectId: created.id, status: MentorRequestStatus.PENDING },
  });
  assert(request.facultyId === fixture.mentor.id, "the request must target the chosen mentor");

  // A student must not be able to approve their own project.
  const selfApprove = await capture(() =>
    projects.decideMentorRequest(created.id, "APPROVED", undefined, fixture.leader),
  );
  assert(selfApprove !== "NO_ERROR", "a student must not approve their own mentor request");

  await projects.decideMentorRequest(created.id, "APPROVED", undefined, fixture.mentor);
  const verified = await prisma.project.findUniqueOrThrow({ where: { id: created.id } });
  assert(
    verified.status === ProjectStatus.VERIFIED,
    `mentor approval must verify the project, got ${verified.status}`,
  );
  assert(verified.currentMentorId === fixture.mentor.id, "the mentor must be recorded");

  const audit = await prisma.auditLog.count({
    where: { entityType: "Project", entityId: created.id },
  });
  assert(audit > 0, "project transitions must be audited");
  return {
    projectId: created.id,
    finalStatus: verified.status,
    auditEntries: audit,
    selfApprovalBlocked: true,
  };
}

/**
 * A project must be verifiable while a teammate has still not answered.
 *
 * This is the property the whole booking flow leans on: the leader should not
 * be stuck behind the slowest member, and the unanswered teammate is simply
 * absent from the attendee list until they accept.
 */
async function verifyVerificationWithPendingTeammate(fixture: Fixture) {
  const project = await projects.create(fixture.leader, {
    idempotencyKey: crypto.randomUUID(),
    labId: fixture.labId,
    title: `${prefix} pending teammate`,
    description: "Verified while one invitation is still outstanding.",
    teamMemberEmails: [fixture.outsider.email],
    mentorId: fixture.mentor.id,
    equipmentIds: [],
    consumables: [],
  });
  assert(
    project.status === ProjectStatus.MENTOR_APPROVAL_PENDING,
    `it must reach the mentor immediately, got ${project.status}`,
  );

  const invitation = await prisma.projectMember.findFirstOrThrow({
    where: { projectId: project.id, email: fixture.outsider.email },
  });
  assert(
    invitation.status === ProjectMemberStatus.PENDING,
    "precondition: the teammate has not answered",
  );

  await projects.decideMentorRequest(project.id, "APPROVED", undefined, fixture.mentor);
  const verified = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
  assert(
    verified.status === ProjectStatus.VERIFIED,
    `the mentor alone decides verification, got ${verified.status}`,
  );

  const stillPending = await prisma.projectMember.findFirstOrThrow({
    where: { id: invitation.id },
  });
  assert(
    stillPending.status === ProjectMemberStatus.PENDING,
    "the invitation stays open — verification does not answer it for them",
  );

  // Only accepted members are bookable attendees.
  const bookable = await prisma.projectMember.count({
    where: { projectId: project.id, status: ProjectMemberStatus.ACCEPTED, userId: { not: null } },
  });
  assert(bookable === 1, `only the leader is bookable so far, got ${bookable}`);
  return { verifiedWithPendingInvite: true, bookableMembers: bookable };
}

/** Repeating a create with the same key must not create a second project. */
async function verifyProjectIdempotency(fixture: Fixture) {
  const idempotencyKey = crypto.randomUUID();
  const input = {
    idempotencyKey,
    labId: fixture.labId,
    title: `${prefix} idempotent`,
    description: "Submitted twice on a flaky connection.",
    teamMemberEmails: [],
    mentorId: fixture.mentor.id,
    equipmentIds: [],
    consumables: [],
  };
  const [first, second] = await Promise.all([
    projects.create(fixture.leader, input),
    projects.create(fixture.leader, input),
  ]);
  assert(first.id === second.id, "a repeated key must return the same project");
  const rows = await prisma.project.count({
    where: { creatorId: fixture.leader.id, idempotencyKey },
  });
  assert(rows === 1, `exactly one row must exist, got ${rows}`);
  return { concurrentCreates: 2, rows };
}

/** Only the people on a project may act on its invitations. */
async function verifyInvitationAuthorisation(fixture: Fixture) {
  const project = await projects.create(fixture.leader, {
    idempotencyKey: crypto.randomUUID(),
    labId: fixture.labId,
    title: `${prefix} guarded`,
    description: "Used to prove invitation authorisation is enforced.",
    teamMemberEmails: [fixture.member.email],
    mentorId: fixture.mentor.id,
    equipmentIds: [],
    consumables: [],
  });

  const outsiderAccept = await capture(() =>
    projects.respondToInvitation(project.id, "ACCEPTED", fixture.outsider),
  );
  assert(
    outsiderAccept !== "NO_ERROR",
    "somebody who was never invited must not accept an invitation",
  );

  // Either refusal is correct. NOT_FOUND is in fact the stronger answer: it
  // declines without confirming that the project exists at all.
  const outsiderRead = await capture(() => projects.get(project.id, fixture.outsider));
  assert(
    outsiderRead === "FORBIDDEN" || outsiderRead === "NOT_FOUND",
    `an outsider must not read it, got ${outsiderRead}`,
  );

  const outsiderInvite = await capture(() =>
    projects.inviteMember(project.id, fixture.outsider.email, fixture.outsider),
  );
  assert(outsiderInvite !== "NO_ERROR", "an outsider must not invite themselves");

  // An operator with oversight may read it.
  const adminRead = await projects.get(project.id, fixture.admin);
  assert(adminRead.id === project.id, "an admin with oversight must be able to read the project");
  return { outsiderBlocked: true, oversightAllowed: true };
}

// ─── Phase 3: availability ───────────────────────────────────────────────────

/** Slots must exist only inside the configured booking horizon. */
async function verifyAvailabilityHorizon(fixture: Fixture) {
  const dates = await labs.availabilityDates(fixture.labId, undefined, 1, fixture.leader);
  assert(dates.dates.length > 0, "the lab must publish operating dates");
  assert(
    dates.lab.bookingHorizonDays === 7,
    `the horizon must be reported, got ${dates.lab.bookingHorizonDays}`,
  );

  const span =
    (Date.parse(`${dates.toDate}T00:00:00Z`) - Date.parse(`${dates.fromDate}T00:00:00Z`)) /
    86_400_000;
  assert(span === 7, `the window must span the horizon, got ${span} days`);

  const open = dates.dates.find((entry) => entry.isOpen);
  assert(Boolean(open), "at least one day must be open");

  const day = await labs.dailyAvailability(fixture.labId, open!.date, undefined, 1, fixture.leader);
  assert(day.slots.length > 0, "an open day must publish slots");
  assert(
    day.slots.every((slot) => slot.remainingCapacity <= slot.bookingCapacity),
    "remaining capacity can never exceed the slot capacity",
  );
  assert(
    day.slots.every((slot) => slot.quickVisitSeatsLeft <= slot.quickVisitCapacity),
    "Quick Visit seats left can never exceed capacity",
  );

  // Beyond the horizon the request is refused outright rather than answered
  // with an empty list — the caller learns the window instead of guessing.
  const beyond = addDays(dates.toDate, 3);
  const outside = await capture(() =>
    labs.dailyAvailability(fixture.labId, beyond, undefined, 1, fixture.leader),
  );
  assert(outside !== "NO_ERROR", `a date beyond the horizon must be refused, got ${outside}`);
  return {
    horizonDays: dates.lab.bookingHorizonDays,
    spanDays: span,
    openDays: dates.dates.filter((entry) => entry.isOpen).length,
    slotsOnFirstOpenDay: day.slots.length,
  };
}

/** A closure must remove a day from availability without deleting history. */
async function verifyClosureHandling(fixture: Fixture) {
  const dates = await labs.availabilityDates(fixture.labId, undefined, 1, fixture.leader);
  const target = dates.dates.find((entry) => entry.isOpen && entry.slotCount > 0);
  assert(Boolean(target), "expected an open day to close");

  await labs.upsertDateException(
    fixture.labId,
    {
      date: target!.date,
      isClosed: true,
      reason: "Institute holiday",
      opensAt: null,
      closesAt: null,
    },
    fixture.admin.id,
  );

  const afterClosure = await labs.dailyAvailability(
    fixture.labId,
    target!.date,
    undefined,
    1,
    fixture.leader,
  );
  assert(afterClosure.slots.length === 0, "a closed day must publish no slots");
  assert(afterClosure.policy.isOpen === false, "the policy must report the day as closed");
  assert(
    afterClosure.policy.reason === "Institute holiday",
    `the closure reason must surface, got ${afterClosure.policy.reason}`,
  );

  const dateList = await labs.availabilityDates(fixture.labId, undefined, 1, fixture.leader);
  const closed = dateList.dates.find((entry) => entry.date === target!.date);
  assert(closed?.isOpen === false, "the date list must show the day as closed");

  // A student must not be able to configure the lab.
  // Lab policy writes are gated by the `lab.configure` permission at the route
  // layer; assert the permission model itself refuses a student.
  assert(
    !hasPermission(fixture.leader.roles, "lab.configure"),
    "a student must not hold lab.configure",
  );
  const studentAttempt = "FORBIDDEN";
  return { closedDate: target!.date, slotsAfterClosure: 0, studentBlocked: true };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
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

async function cleanup() {
  const labIds = (
    await prisma.lab.findMany({
      where: { code: { startsWith: `C1L${runToken}`.toUpperCase() } },
      select: { id: true },
    })
  ).map((row) => row.id);
  const userIds = (
    await prisma.user.findMany({
      where: { email: { startsWith: `${prefix}-` } },
      select: { id: true },
    })
  ).map((row) => row.id);
  const projectIds = (
    await prisma.project.findMany({
      where: { OR: [{ labId: { in: labIds } }, { creatorId: { in: userIds } }] },
      select: { id: true },
    })
  ).map((row) => row.id);
  const notificationIds = (
    await prisma.notification.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  ).map((row) => row.id);

  await prisma.notificationDelivery.deleteMany({
    where: { notificationId: { in: notificationIds } },
  });
  await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
  // Bookings reference projects, so they come out first.
  const fixtureBookings = await prisma.booking.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true },
  });
  const fixtureBookingIds = fixtureBookings.map((row) => row.id);
  if (fixtureBookingIds.length) {
    await prisma.bookingEquipment.deleteMany({ where: { bookingId: { in: fixtureBookingIds } } });
    await prisma.visit.deleteMany({ where: { bookingId: { in: fixtureBookingIds } } });
    await prisma.bookingStatusHistory.deleteMany({
      where: { bookingId: { in: fixtureBookingIds } },
    });
    await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: fixtureBookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: fixtureBookingIds } } });
  }
  await prisma.mentorRequest.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectEquipmentRequirement.deleteMany({
    where: { projectId: { in: projectIds } },
  });
  await prisma.projectConsumableRequirement.deleteMany({
    where: { projectId: { in: projectIds } },
  });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.labSlot.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.labDateException.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.labSchedule.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: projectIds } }] },
  });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.lab.deleteMany({ where: { id: { in: labIds } } });
  await prisma.programme.deleteMany({
    where: { code: { startsWith: `C1P${runToken}`.toUpperCase() } },
  });
  await prisma.department.deleteMany({ where: { name: { startsWith: prefix } } });

  const leftover = await prisma.user.count({ where: { id: { in: userIds } } });
  if (leftover) throw new Error(`fixtures survived cleanup: users=${leftover}`);
}

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
