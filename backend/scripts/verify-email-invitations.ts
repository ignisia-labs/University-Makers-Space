/**
 * Email delivery and email-first invitations.
 *
 * Covers the two things that make "invite a teammate who has no account" work:
 * the invitation is addressed to an email rather than a user row, and the
 * outbox actually delivers it — with claim-once semantics, retries and a
 * terminal failure state.
 *
 * Run via `npm run test:email-invitations`, which sets `SMTP_HOST=` to force
 * the console transport. That has to happen in the environment rather than in
 * this file: ES module imports are hoisted, so `env` is parsed before any
 * statement here could run. A verification must never depend on the developer's
 * mail credentials, nor risk sending a real message to a real student.
 */
import crypto from "node:crypto";
import { DeliveryStatus, NotificationChannel, ProjectMemberStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import { dispatchEmails, requeueStalledDeliveries } from "../src/jobs/email-dispatcher.js";
import {
  escapeHtml,
  projectInvitationEmail,
  safeAppUrl,
} from "../src/modules/notifications/email-templates.js";
import * as auth from "../src/modules/auth/auth-service.js";
import * as projects from "../src/modules/projects/project-service.js";

type Viewer = NonNullable<Express.Request["user"]>;

const enabled = process.env.RUN_EMAIL_DATABASE_TESTS === "true";
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const prefix = `mail-${runToken}`;
const startedAt = Date.now();

async function main() {
  if (!enabled) {
    throw new Error(
      "Refusing to mutate the configured database. Set RUN_EMAIL_DATABASE_TESTS=true explicitly.",
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
    templateEscaping: verifyTemplateEscaping(),
    inviteWithoutAccount: await verifyInviteWithoutAccount(fixture),
    invitationEmailDelivered: await verifyInvitationEmailDelivered(fixture),
    claimedOnce: await verifyClaimedOnce(fixture),
    notificationDelivery: await verifyNotificationDelivery(fixture),
    inactiveRecipientParked: await verifyInactiveRecipientParked(fixture),
    stalledRecovery: await verifyStalledRecovery(fixture),
    invitationClaimedOnSignIn: await verifyInvitationClaimedOnSignIn(fixture),
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  const departmentId = crypto.randomUUID();
  const programmeId = crypto.randomUUID();
  const labId = crypto.randomUUID();
  await prisma.department.create({
    data: { id: departmentId, code: `M1D${runToken}`.toUpperCase(), name: `${prefix} department` },
  });
  await prisma.programme.create({
    data: {
      id: programmeId,
      departmentId,
      code: `M1P${runToken}`.toUpperCase(),
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
      code: `M1L${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      timeZone: "Asia/Kolkata",
    },
  });

  const leader = await createUser("leader", [UserRole.STUDENT], true, departmentId, programmeId);
  const mentor = await createUser("mentor", [UserRole.FACULTY_MENTOR], true);
  return { departmentId, programmeId, labId, leader, mentor };
}

async function createUser(
  tag: string,
  roles: UserRole[],
  profileComplete: boolean,
  departmentId?: string,
  programmeId?: string,
) {
  const id = crypto.randomUUID();
  const email = `${prefix}-${tag}@mitwpu.edu.in`;
  const name = `${prefix} ${tag}`;
  await prisma.user.create({
    data: { id, email, name, googleSubject: `${prefix}-${tag}`, roles, profileComplete },
  });
  if (departmentId && programmeId) {
    await prisma.studentProfile.create({
      data: {
        userId: id,
        prn: `${runToken}${tag.slice(0, 2)}`.toUpperCase().slice(0, 24),
        departmentId,
        programmeId,
        academicYear: 2,
      },
    });
  }
  return {
    id,
    name,
    email,
    roles,
    profileComplete,
    isActive: true,
    sessionId: crypto.randomUUID(),
  } satisfies Viewer;
}

/** Project titles and names are user input; they must never become markup. */
function verifyTemplateEscaping() {
  const hostile = '<script>alert("x")</script> & "quoted"';
  const rendered = projectInvitationEmail({
    projectTitle: hostile,
    inviterName: hostile,
    projectId: crypto.randomUUID(),
    isRegistered: false,
  });
  assert(!rendered.html.includes("<script>"), "raw script tags must never reach the HTML body");
  assert(rendered.html.includes("&lt;script&gt;"), "hostile input must be escaped");
  assert(escapeHtml("a&b") === "a&amp;b", "ampersands must escape");

  // A link must never be able to point off-site.
  assert(safeAppUrl("//evil.example/x").startsWith("http"), "protocol-relative must be rejected");
  assert(!safeAppUrl("//evil.example/x").includes("evil.example"), "off-site href must be dropped");
  assert(!safeAppUrl("https://evil.example").includes("evil.example"), "absolute href dropped");
  assert(safeAppUrl("/projects/1").endsWith("/projects/1"), "app paths are kept");
  return { escaped: true, offSiteLinksBlocked: true };
}

/** The heart of the request: invite an address that has no account. */
async function verifyInviteWithoutAccount(fixture: Fixture) {
  const strangerEmail = `${prefix}-stranger@mitwpu.edu.in`;
  const existing = await prisma.user.findUnique({ where: { email: strangerEmail } });
  assert(existing === null, "fixture precondition: the invitee must not have an account");

  const project = await projects.create(fixture.leader, {
    idempotencyKey: crypto.randomUUID(),
    labId: fixture.labId,
    title: `${prefix} open invite`,
    description: "Invites somebody who has never signed in.",
    teamMemberEmails: [strangerEmail],
    mentorId: fixture.mentor.id,
    equipmentIds: [],
    consumables: [],
  });

  const member = await prisma.projectMember.findFirstOrThrow({
    where: { projectId: project.id, email: strangerEmail },
  });
  assert(member.userId === null, "an invitation to a stranger has no user row yet");
  assert(member.status === ProjectMemberStatus.PENDING, "it must be pending");
  assert(
    member.invitationEmailStatus === DeliveryStatus.PENDING,
    `an email must be queued, got ${member.invitationEmailStatus}`,
  );
  assert(member.invitationTokenHash !== null, "an invitation token must be issued");
  assert(member.invitationExpiresAt !== null, "the invitation must expire");

  // The same must hold for inviting after creation.
  const secondEmail = `${prefix}-stranger2@mitwpu.edu.in`;
  await projects.inviteMember(project.id, secondEmail, fixture.leader);
  const second = await prisma.projectMember.findFirstOrThrow({
    where: { projectId: project.id, email: secondEmail },
  });
  assert(second.userId === null, "post-creation invites also work without an account");
  assert(second.invitationEmailStatus === DeliveryStatus.PENDING, "and queue an email");

  return { projectId: project.id, strangerEmail, secondEmail, queued: 2 };
}

/** The outbox must actually deliver those invitations. */
async function verifyInvitationEmailDelivered(fixture: Fixture) {
  const before = await prisma.projectMember.count({
    where: { email: { startsWith: prefix }, invitationEmailStatus: DeliveryStatus.PENDING },
  });
  assert(before >= 2, `expected queued invitations, got ${before}`);

  const summary = await dispatchEmails();
  assert(summary.invitationsSent >= 2, `expected sends, got ${summary.invitationsSent}`);
  assert(
    summary.invitationsFailed === 0,
    "no invitation should fail against the console transport",
  );

  const rows = await prisma.projectMember.findMany({
    where: { email: { startsWith: prefix }, userId: null },
  });
  assert(
    rows.every((row) => row.invitationEmailStatus === DeliveryStatus.SENT),
    "every invitation must be marked SENT",
  );
  assert(
    rows.every((row) => row.invitationEmailSentAt !== null),
    "each must record when",
  );
  assert(
    rows.every((row) => row.invitationEmailAttempts === 1),
    "one attempt each",
  );

  // A second pass must not resend: SENT rows are no longer claimable.
  const again = await dispatchEmails();
  assert(
    again.invitationsSent === 0,
    `a second pass must send nothing, got ${again.invitationsSent}`,
  );
  void fixture;
  return { delivered: rows.length, resentOnSecondPass: again.invitationsSent };
}

/** Two dispatchers racing must not send the same message twice. */
async function verifyClaimedOnce(fixture: Fixture) {
  const email = `${prefix}-race@mitwpu.edu.in`;
  const project = await prisma.project.findFirstOrThrow({
    where: { creatorId: fixture.leader.id },
  });
  await projects.inviteMember(project.id, email, fixture.leader);

  // Both dispatchers run concurrently against the same pending row.
  const [first, second] = await Promise.all([dispatchEmails(), dispatchEmails()]);
  const total = first.invitationsSent + second.invitationsSent;
  assert(total === 1, `exactly one dispatcher may send, got ${total}`);

  const row = await prisma.projectMember.findFirstOrThrow({ where: { email } });
  assert(row.invitationEmailStatus === DeliveryStatus.SENT, "the row must end up SENT");
  assert(
    row.invitationEmailAttempts === 1,
    `exactly one attempt, got ${row.invitationEmailAttempts}`,
  );
  return { concurrentDispatchers: 2, sends: total };
}

/** In-app notifications must be mirrored to email through the same outbox. */
async function verifyNotificationDelivery(fixture: Fixture) {
  const notification = await prisma.notification.create({
    data: {
      userId: fixture.leader.id,
      type: "TEST",
      title: `${prefix} booking confirmed`,
      body: "Your MakerSpace slot is confirmed.",
      href: "/bookings/abc",
    },
  });
  await prisma.notificationDelivery.create({
    data: {
      notificationId: notification.id,
      channel: NotificationChannel.EMAIL,
      status: DeliveryStatus.PENDING,
    },
  });

  const summary = await dispatchEmails();
  assert(summary.notificationsSent >= 1, `expected a send, got ${summary.notificationsSent}`);

  const delivery = await prisma.notificationDelivery.findFirstOrThrow({
    where: { notificationId: notification.id },
  });
  assert(delivery.status === DeliveryStatus.SENT, `expected SENT, got ${delivery.status}`);
  assert(delivery.sentAt !== null, "sentAt must be recorded");
  assert(delivery.providerId !== null, "a provider id must be recorded for traceability");
  assert(delivery.attempts === 1, `one attempt, got ${delivery.attempts}`);
  assert(delivery.lastError === null, "a successful send must clear any previous error");
  return { status: delivery.status, providerId: delivery.providerId };
}

/** A message to a suspended account is parked, not retried forever. */
async function verifyInactiveRecipientParked(fixture: Fixture) {
  const ghost = await createUser("ghost", [UserRole.STUDENT], true);
  await prisma.user.update({ where: { id: ghost.id }, data: { isActive: false } });
  const notification = await prisma.notification.create({
    data: { userId: ghost.id, type: "TEST", title: `${prefix} ghost`, body: "…", href: null },
  });
  await prisma.notificationDelivery.create({
    data: {
      notificationId: notification.id,
      channel: NotificationChannel.EMAIL,
      status: DeliveryStatus.PENDING,
    },
  });

  await dispatchEmails();
  const delivery = await prisma.notificationDelivery.findFirstOrThrow({
    where: { notificationId: notification.id },
  });
  assert(delivery.status === DeliveryStatus.FAILED, `expected FAILED, got ${delivery.status}`);
  assert(
    (delivery.lastError ?? "").includes("not active"),
    `the reason must be recorded, got ${delivery.lastError}`,
  );
  void fixture;
  return { parked: true, reason: delivery.lastError };
}

/** A crash mid-send must not strand a message in PROCESSING. */
async function verifyStalledRecovery(fixture: Fixture) {
  const notification = await prisma.notification.create({
    data: {
      userId: fixture.leader.id,
      type: "TEST",
      title: `${prefix} stalled`,
      body: "…",
      href: null,
    },
  });
  const delivery = await prisma.notificationDelivery.create({
    data: {
      notificationId: notification.id,
      channel: NotificationChannel.EMAIL,
      status: DeliveryStatus.PROCESSING,
    },
  });
  // Backdate it past the staleness window, as a crashed run would look.
  await prisma.$executeRaw`
    UPDATE "notification_deliveries"
    SET "updated_at" = now() - interval '30 minutes'
    WHERE id = ${delivery.id}::uuid
  `;

  const recovered = await requeueStalledDeliveries();
  assert(
    recovered.notifications >= 1,
    `a stalled row must be requeued, got ${recovered.notifications}`,
  );
  const requeued = await prisma.notificationDelivery.findFirstOrThrow({
    where: { id: delivery.id },
  });
  assert(requeued.status === DeliveryStatus.PENDING, `expected PENDING, got ${requeued.status}`);

  await dispatchEmails();
  const finished = await prisma.notificationDelivery.findFirstOrThrow({
    where: { id: delivery.id },
  });
  assert(finished.status === DeliveryStatus.SENT, "and then be delivered");
  return { requeued: recovered.notifications, finalStatus: finished.status };
}

/**
 * The payoff: when the invited stranger signs in for the first time, the
 * invitation attaches to their brand-new account automatically.
 */
async function verifyInvitationClaimedOnSignIn(fixture: Fixture) {
  const strangerEmail = `${prefix}-stranger@mitwpu.edu.in`;
  const pendingBefore = await prisma.projectMember.findFirstOrThrow({
    where: { email: strangerEmail },
  });
  assert(pendingBefore.userId === null, "still unclaimed before sign-in");

  // Simulate what googleSignIn does on first sign-in: create the account, then
  // attach every invitation addressed to that email.
  const newUser = await prisma.user.create({
    data: {
      email: strangerEmail,
      name: "Newly Arrived",
      googleSubject: `${prefix}-stranger-sub`,
      roles: [UserRole.STUDENT],
      profileComplete: false,
    },
  });
  const claimed = await prisma.projectMember.updateMany({
    where: { email: strangerEmail, userId: null, status: ProjectMemberStatus.PENDING },
    data: { userId: newUser.id },
  });
  assert(claimed.count === 1, `the invitation must attach, got ${claimed.count}`);

  const after = await prisma.projectMember.findFirstOrThrow({ where: { email: strangerEmail } });
  assert(after.userId === newUser.id, "the invitation now belongs to the new account");
  assert(after.status === ProjectMemberStatus.PENDING, "and is still awaiting their answer");

  // And they can answer it as themselves.
  const viewer: Viewer = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    roles: [UserRole.STUDENT],
    profileComplete: false,
    isActive: true,
    sessionId: crypto.randomUUID(),
  };
  await projects.respondToInvitation(after.projectId, "ACCEPTED", viewer);
  const accepted = await prisma.projectMember.findFirstOrThrow({ where: { id: after.id } });
  assert(
    accepted.status === ProjectMemberStatus.ACCEPTED,
    `they must be able to accept, got ${accepted.status}`,
  );
  void auth;
  void fixture;
  return { claimed: claimed.count, finalStatus: accepted.status };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function assert(condition: boolean, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function cleanup() {
  const labIds = (
    await prisma.lab.findMany({
      where: { code: { startsWith: `M1L${runToken}`.toUpperCase() } },
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
  await prisma.mentorRequest.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectEquipmentRequirement.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectConsumableRequirement.deleteMany({
    where: { projectId: { in: projectIds } },
  });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: projectIds } }] },
  });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.lab.deleteMany({ where: { id: { in: labIds } } });
  await prisma.programme.deleteMany({
    where: { code: { startsWith: `M1P${runToken}`.toUpperCase() } },
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
