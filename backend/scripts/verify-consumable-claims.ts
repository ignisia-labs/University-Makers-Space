/**
 * Material claims: allowance, verification, and depletion.
 *
 * The rules under test are the ones a student and a Lab Assistant would notice
 * if they broke: a team cannot claim more than its mentor approved, two
 * teammates claiming at once cannot both slip past the allowance, and material
 * that has been issued never comes back.
 *
 * Run:
 *   RUN_CLAIM_TESTS=true npx tsx scripts/verify-consumable-claims.ts
 */
import crypto from "node:crypto";
import {
  ConsumableClaimStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import * as claims from "../src/modules/consumables/claim-service.js";

type Viewer = NonNullable<Express.Request["user"]>;

const enabled = process.env.RUN_CLAIM_TESTS === "true";
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const prefix = `claims-${runToken}`;
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
    throw new Error("Refusing to mutate the configured database. Set RUN_CLAIM_TESTS=true.");
  }
  let assertions: Record<string, unknown> | undefined;
  let failure: unknown;
  let cleanupFailure: unknown;
  try {
    assertions = await run();
  } catch (error) {
    failure = error;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (failure || cleanupFailure) {
    console.error(
      JSON.stringify({
        ok: false,
        ...(failure ? { failure: describe(failure) } : {}),
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
    allowanceReported: await verifyAllowance(fx),
    pendingCountsAgainstAllowance: await verifyPendingCounts(fx),
    overClaimRefused: await verifyOverClaimRefused(fx),
    issuingSpendsStock: await verifyIssuingSpendsStock(fx),
    rejectionKeepsStock: await verifyRejectionKeepsStock(fx),
    exhaustedIsNotClaimable: await verifyExhausted(fx),
    foreignMaterialRefused: await verifyForeignMaterial(fx),
    outsiderRefused: await verifyOutsider(fx),
    concurrentClaimsBounded: await verifyConcurrentClaims(fx),
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture() {
  const departmentId = crypto.randomUUID();
  const programmeId = crypto.randomUUID();
  const labId = crypto.randomUUID();
  registry.departmentIds.push(departmentId);
  registry.programmeIds.push(programmeId);
  registry.labIds.push(labId);

  await prisma.department.create({
    data: { id: departmentId, code: `CL${runToken}`.toUpperCase(), name: `${prefix} department` },
  });
  await prisma.programme.create({
    data: {
      id: programmeId,
      departmentId,
      code: `CLP${runToken}`.toUpperCase(),
      name: `${prefix} programme`,
    },
  });
  await prisma.lab.create({
    data: {
      id: labId,
      code: `CLL${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      description: "Temporary claim fixture",
      timeZone: "Asia/Kolkata",
      bookingCapacity: 8,
      quickVisitCapacity: 4,
    },
  });

  const categoryId = crypto.randomUUID();
  await prisma.consumableCategory.create({
    data: { id: categoryId, labId, name: `${prefix} materials` },
  });
  const filament = await prisma.consumable.create({
    data: {
      labId,
      categoryId,
      name: `${prefix} filament`,
      unit: "spool",
      variants: ["1.75 mm White", "1.75 mm Black"],
      maxPerProject: 5,
      stockQuantity: 10,
    },
  });
  const resin = await prisma.consumable.create({
    data: {
      labId,
      categoryId,
      name: `${prefix} resin`,
      unit: "bottle",
      stockQuantity: 2,
    },
  });
  const unowned = await prisma.consumable.create({
    data: {
      labId,
      categoryId,
      name: `${prefix} unowned sheet`,
      unit: "sheet",
      stockQuantity: 5,
    },
  });

  const users = await createUsers(departmentId, programmeId, 3);
  // The mentor approved 3 spools of filament and 1 bottle of resin.
  const project = await createProject(
    labId,
    [users[0]!, users[1]!],
    [
      { consumableId: filament.id, quantity: 3 },
      { consumableId: resin.id, quantity: 1 },
    ],
  );

  return {
    labId,
    filamentId: filament.id,
    resinId: resin.id,
    unownedId: unowned.id,
    project,
    teammate: viewerFor(users[1]!),
    outsider: viewerFor(users[2]!),
    staff: {
      id: users[2]!.id,
      name: users[2]!.name,
      email: users[2]!.email,
      roles: [UserRole.LAB_ASSISTANT],
    } as Viewer,
  };
}

type CreatedUser = { id: string; name: string; email: string; prn: string };

function viewerFor(user: CreatedUser): Viewer {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: [UserRole.STUDENT],
  } as Viewer;
}

async function createUsers(departmentId: string, programmeId: string, count: number) {
  const users: CreatedUser[] = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    name: `${prefix} student ${index + 1}`,
    email: `${prefix}-${index + 1}@mitwpu.edu.in`,
    prn: `CL${runToken}${index + 1}`.toUpperCase().slice(0, 24),
  }));
  registry.userIds.push(...users.map((user) => user.id));
  await prisma.user.createMany({
    data: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: [UserRole.STUDENT],
      profileComplete: true,
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
  team: CreatedUser[],
  consumables: Array<{ consumableId: string; quantity: number }>,
) {
  const leader = team[0]!;
  const id = crypto.randomUUID();
  registry.projectIds.push(id);
  await prisma.project.create({
    data: {
      id,
      labId,
      creatorId: leader.id,
      title: `${prefix} project`,
      description: "Temporary project for material-claim verification.",
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
      consumableRequirements: {
        create: consumables.map((entry) => ({
          consumableId: entry.consumableId,
          expectedQuantity: entry.quantity,
        })),
      },
    },
  });
  return { id, leader: viewerFor(leader) };
}

const claim = (fx: Fixture, viewer: Viewer, consumableId: string, quantity: number) =>
  claims.create(viewer, {
    projectId: fx.project.id,
    consumableId,
    quantity,
    idempotencyKey: crypto.randomUUID(),
  });

/* ── verifications ────────────────────────────────────────────────────────── */

async function verifyAllowance(fx: Fixture) {
  const rows = await claims.allowanceFor(fx.project.id, fx.project.leader);
  const filament = rows.find((row) => row.consumableId === fx.filamentId)!;
  assert(filament.approvedQuantity === 3, `approved must be 3, got ${filament.approvedQuantity}`);
  assert(filament.remainingQuantity === 3, "nothing claimed yet, so all 3 remain");
  assert(filament.claimable, "material in stock with allowance left must be claimable");
  assert(filament.variants.length === 2, "the material's selectable forms must reach the student");
  return { materials: rows.length, approved: filament.approvedQuantity };
}

async function verifyPendingCounts(fx: Fixture) {
  const first = await claim(fx, fx.project.leader, fx.filamentId, 2);
  const rows = await claims.allowanceFor(fx.project.id, fx.project.leader);
  const filament = rows.find((row) => row.consumableId === fx.filamentId)!;
  assert(
    filament.pendingQuantity === 2 && filament.remainingQuantity === 1,
    `a pending claim must reserve allowance, got pending ${filament.pendingQuantity} remaining ${filament.remainingQuantity}`,
  );
  await claims.cancel(first.claim.id, fx.project.leader);

  const afterWithdrawal = await claims.allowanceFor(fx.project.id, fx.project.leader);
  const restored = afterWithdrawal.find((row) => row.consumableId === fx.filamentId)!;
  assert(
    restored.remainingQuantity === 3,
    "withdrawing a claim must return the allowance, since nothing was handed over",
  );
  return { pendingReserves: true, withdrawalRestores: true };
}

async function verifyOverClaimRefused(fx: Fixture) {
  const code = await expectFailure(() => claim(fx, fx.project.leader, fx.filamentId, 4));
  assert(
    code === "CLAIM_EXCEEDS_APPROVED",
    `claiming more than the mentor approved must be refused, got ${code}`,
  );
  return { refused: true };
}

async function verifyIssuingSpendsStock(fx: Fixture) {
  const before = await stockOf(fx.filamentId);
  const created = await claim(fx, fx.project.leader, fx.filamentId, 2);
  const issued = await claims.decide(created.claim.id, "ISSUED", null, fx.staff);
  assert(issued.status === ConsumableClaimStatus.ISSUED, "the claim must be marked issued");

  const after = await stockOf(fx.filamentId);
  assert(after === before - 2, `issuing must spend stock: ${before} → ${after}`);

  // And it never comes back — there is no path that returns issued material.
  const rows = await claims.allowanceFor(fx.project.id, fx.project.leader);
  const filament = rows.find((row) => row.consumableId === fx.filamentId)!;
  assert(filament.issuedQuantity === 2, "issued quantity must be recorded against the project");
  assert(filament.remainingQuantity === 1, "the allowance must shrink permanently");

  const second = await expectFailure(() =>
    claims.decide(created.claim.id, "ISSUED", null, fx.staff),
  );
  assert(second === "CLAIM_ALREADY_DECIDED", `issuing twice must be refused, got ${second}`);
  assert(
    (await stockOf(fx.filamentId)) === after,
    "a refused second issue must not spend stock again",
  );
  return { stockSpent: before - after, doubleIssueRefused: true };
}

async function verifyRejectionKeepsStock(fx: Fixture) {
  const before = await stockOf(fx.filamentId);
  const created = await claim(fx, fx.teammate, fx.filamentId, 1);
  await claims.decide(created.claim.id, "REJECTED", "Not needed for this print", fx.staff);
  assert((await stockOf(fx.filamentId)) === before, "declining a claim must not spend stock");

  const rows = await claims.allowanceFor(fx.project.id, fx.project.leader);
  const filament = rows.find((row) => row.consumableId === fx.filamentId)!;
  assert(
    filament.remainingQuantity === 1,
    "a declined claim must release its hold on the allowance",
  );
  return { stockUnchanged: true, allowanceReleased: true };
}

async function verifyExhausted(fx: Fixture) {
  // One spool of allowance remains; claim and issue it.
  const created = await claim(fx, fx.project.leader, fx.filamentId, 1);
  await claims.decide(created.claim.id, "ISSUED", null, fx.staff);

  const rows = await claims.allowanceFor(fx.project.id, fx.project.leader);
  const filament = rows.find((row) => row.consumableId === fx.filamentId)!;
  assert(filament.remainingQuantity === 0, "the allowance must now be spent");
  assert(!filament.claimable, "a fully claimed material must not be offered again");

  const code = await expectFailure(() => claim(fx, fx.project.leader, fx.filamentId, 1));
  assert(code === "CLAIM_EXCEEDS_APPROVED", `a further claim must be refused, got ${code}`);
  return { exhausted: true, hidden: true };
}

async function verifyForeignMaterial(fx: Fixture) {
  const code = await expectFailure(() => claim(fx, fx.project.leader, fx.unownedId, 1));
  assert(
    code === "CONSUMABLE_NOT_IN_PROJECT",
    `claiming material the project never listed must be refused, got ${code}`,
  );
  return { refused: true };
}

async function verifyOutsider(fx: Fixture) {
  const code = await expectFailure(() => claim(fx, fx.outsider, fx.resinId, 1));
  assert(code === "FORBIDDEN", `a non-member must not claim, got ${code}`);
  return { refused: true };
}

async function verifyConcurrentClaims(fx: Fixture) {
  // One bottle of resin is approved. Both teammates reach for it at once.
  const settled = await Promise.allSettled([
    claim(fx, fx.project.leader, fx.resinId, 1),
    claim(fx, fx.teammate, fx.resinId, 1),
  ]);
  const won = settled.filter((entry) => entry.status === "fulfilled").length;
  assert(won === 1, `exactly one concurrent claim may take the last unit, got ${won}`);

  const committed = await prisma.consumableClaim.aggregate({
    where: {
      projectId: fx.project.id,
      consumableId: fx.resinId,
      status: { in: [ConsumableClaimStatus.PENDING, ConsumableClaimStatus.ISSUED] },
    },
    _sum: { quantity: true },
  });
  assert(
    (committed._sum.quantity ?? 0) === 1,
    `the database must never hold more than the approved 1, found ${committed._sum.quantity}`,
  );
  return { winners: won, committed: committed._sum.quantity };
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function stockOf(consumableId: string) {
  const row = await prisma.consumable.findUniqueOrThrow({
    where: { id: consumableId },
    select: { stockQuantity: true },
  });
  return row.stockQuantity;
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
  await prisma.consumableClaim.deleteMany({ where: { labId: { in: registry.labIds } } });
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
  await prisma.projectConsumableRequirement.deleteMany({
    where: { projectId: { in: registry.projectIds } },
  });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: registry.projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: registry.projectIds } } });
  await prisma.consumable.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.consumableCategory.deleteMany({ where: { labId: { in: registry.labIds } } });
  await prisma.lab.deleteMany({ where: { id: { in: registry.labIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: registry.userIds } } });
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
