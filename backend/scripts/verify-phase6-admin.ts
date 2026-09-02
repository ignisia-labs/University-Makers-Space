/**
 * Phase 6 administration verification.
 *
 * Exercises dashboards, audit review, CSV export and reference-data
 * administration against a real PostgreSQL database.
 *
 * Run:
 *   RUN_PHASE6_DATABASE_TESTS=true npx tsx scripts/verify-phase6-admin.ts
 */
import crypto from "node:crypto";
import { PassThrough } from "node:stream";
import type { Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/config/db.js";
import { redis } from "../src/config/redis.js";
import * as audit from "../src/modules/admin/audit-service.js";
import * as dashboards from "../src/modules/admin/dashboard-service.js";
import { csvCell, streamCsv } from "../src/modules/admin/export-service.js";
import * as reference from "../src/modules/admin/reference-admin-service.js";
import { hasPermission } from "../src/config/permissions.js";
import { localToday, zonedLocalMinuteToUtc } from "../src/modules/labs/lab-time.js";

type Viewer = NonNullable<Express.Request["user"]>;

const enabled = process.env.RUN_PHASE6_DATABASE_TESTS === "true";
const runToken = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const prefix = `phase6-${runToken}`;
const startedAt = Date.now();

async function main() {
  if (!enabled) {
    throw new Error(
      "Refusing to mutate the configured database. Set RUN_PHASE6_DATABASE_TESTS=true explicitly.",
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
    csvInjection: verifyCsvInjectionHardening(),
    permissionMatrix: verifyPermissionMatrix(),
    referenceCascade: await verifyReferenceCascade(fixture),
    referenceGuards: await verifyReferenceGuards(fixture),
    referenceDeletion: await verifyReferenceDeletion(fixture),
    auditTrail: await verifyAuditTrail(fixture),
    dashboard: await verifyDashboard(fixture),
    dashboardTimeZoneWindow: await verifyDashboardTimeZoneWindow(fixture),
    csvExport: await verifyCsvExport(fixture),
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  const labId = crypto.randomUUID();
  await prisma.lab.create({
    data: {
      id: labId,
      code: `P6L${runToken}`.toUpperCase(),
      name: `${prefix} MakerSpace`,
      timeZone: "Asia/Kolkata",
      bookingCapacity: 20,
      quickVisitCapacity: 10,
    },
  });
  const adminId = crypto.randomUUID();
  await prisma.user.create({
    data: {
      id: adminId,
      email: `${prefix}-admin@mitwpu.edu.in`,
      name: `${prefix} Admin`,
      googleSubject: `${prefix}-admin`,
      roles: [UserRole.ADMIN],
      profileComplete: true,
    },
  });
  const admin: Viewer = {
    id: adminId,
    name: `${prefix} Admin`,
    email: `${prefix}-admin@mitwpu.edu.in`,
    roles: [UserRole.ADMIN],
    profileComplete: true,
    isActive: true,
    sessionId: crypto.randomUUID(),
  };
  return { labId, admin };
}

/**
 * A cell that starts with `=`, `+`, `-` or `@` is executed as a formula by
 * Excel and Sheets. This is the single most common way a "harmless" CSV export
 * turns into remote code execution on a staff laptop.
 */
function verifyCsvInjectionHardening() {
  const dangerous = [
    "=1+1",
    "+1",
    "-1",
    "@SUM(A1)",
    '=HYPERLINK("http://evil.example","click")',
    "\tTAB",
  ];
  for (const value of dangerous) {
    const rendered = csvCell(value);
    assert(
      rendered.startsWith("\"'"),
      `formula-like cell must be neutralised, got ${rendered} for ${value}`,
    );
  }
  // Quoting must still be RFC 4180 correct.
  assert(csvCell('say "hi"') === '"say ""hi"""', "embedded quotes must be doubled");
  assert(csvCell("a,b") === '"a,b"', "commas must be quoted");
  assert(csvCell(null) === "", "null renders empty");
  assert(csvCell("safe") === '"safe"', "ordinary text is untouched");
  return { neutralised: dangerous.length, rfc4180: true };
}

/** Phase 6 privileges must not leak downward to students or assistants. */
function verifyPermissionMatrix() {
  const cases: Array<[UserRole, string, boolean]> = [
    [UserRole.STUDENT, "audit.read", false],
    [UserRole.STUDENT, "reference_data.manage", false],
    [UserRole.STUDENT, "report.export", false],
    [UserRole.STUDENT, "dashboard.read", false],
    [UserRole.FACULTY_MENTOR, "audit.read", false],
    [UserRole.FACULTY_MENTOR, "report.export", false],
    [UserRole.LAB_ASSISTANT, "dashboard.read", true],
    [UserRole.LAB_ASSISTANT, "audit.read", false],
    [UserRole.LAB_ASSISTANT, "reference_data.manage", false],
    [UserRole.LAB_ASSISTANT, "report.export", false],
    [UserRole.ADMIN, "audit.read", true],
    [UserRole.ADMIN, "reference_data.manage", true],
    [UserRole.ADMIN, "report.export", true],
    [UserRole.ADMIN, "user.roles.manage", false],
    [UserRole.SUPER_ADMIN, "user.roles.manage", true],
    [UserRole.SUPER_ADMIN, "audit.read", true],
  ];
  for (const [role, permission, expected] of cases) {
    const actual = hasPermission([role], permission as Parameters<typeof hasPermission>[1]);
    assert(actual === expected, `${role} ${permission}: expected ${expected}, got ${actual}`);
  }
  return { checked: cases.length };
}

/** Deactivating a parent must deactivate its children, not orphan them. */
async function verifyReferenceCascade(fixture: Fixture) {
  const department = await reference.createDepartment(
    { code: `P6${runToken}`.toUpperCase().slice(0, 12), name: `${prefix} Department` },
    fixture.admin,
  );
  const programme = await reference.createProgramme(
    {
      departmentId: department.id,
      code: `P6P${runToken}`.toUpperCase().slice(0, 12),
      name: `${prefix} Programme`,
    },
    fixture.admin,
  );
  assert(programme.isActive, "new programme should be active");

  await reference.updateDepartment(department.id, { isActive: false }, fixture.admin);
  const cascaded = await prisma.programme.findUniqueOrThrow({ where: { id: programme.id } });
  assert(!cascaded.isActive, "deactivating a department must deactivate its programmes");

  // Nothing was deleted — history survives.
  const stillThere = await prisma.department.findUnique({ where: { id: department.id } });
  assert(Boolean(stillThere), "reference rows must be deactivated, never deleted");

  const category = await reference.createConsumableCategory(
    { labId: fixture.labId, name: `${prefix} Filament` },
    fixture.admin,
  );
  const consumable = await reference.createConsumable(
    { labId: fixture.labId, categoryId: category.id, name: `${prefix} PLA`, unit: "kg" },
    fixture.admin,
  );
  await reference.updateConsumableCategory(category.id, { isActive: false }, fixture.admin);
  const cascadedConsumable = await prisma.consumable.findUniqueOrThrow({
    where: { id: consumable.id },
  });
  assert(!cascadedConsumable.isActive, "deactivating a category must deactivate its consumables");

  return {
    departmentDeactivated: true,
    programmeCascaded: true,
    consumableCascaded: true,
    rowsPreserved: true,
    departmentId: department.id,
    programmeId: programme.id,
    categoryId: category.id,
    consumableId: consumable.id,
  };
}

/** Reactivating a child under a dormant parent must be refused. */
async function verifyReferenceGuards(fixture: Fixture) {
  const department = await reference.createDepartment(
    { code: `P6G${runToken}`.toUpperCase().slice(0, 12), name: `${prefix} Guarded Dept` },
    fixture.admin,
  );
  await reference.updateDepartment(department.id, { isActive: false }, fixture.admin);

  const orphanProgramme = await capture(() =>
    reference.createProgramme(
      {
        departmentId: department.id,
        code: `P6X${runToken}`.toUpperCase().slice(0, 12),
        name: "orphan",
      },
      fixture.admin,
    ),
  );
  assert(
    orphanProgramme === "DEPARTMENT_INACTIVE",
    `adding to a dormant department must fail, got ${orphanProgramme}`,
  );

  const missing = await capture(() =>
    reference.updateDepartment(crypto.randomUUID(), { name: "nope" }, fixture.admin),
  );
  assert(missing === "NOT_FOUND", `unknown id must 404, got ${missing}`);

  const mismatched = await capture(() =>
    reference.createConsumable(
      { labId: crypto.randomUUID(), categoryId: crypto.randomUUID(), name: "x", unit: "kg" },
      fixture.admin,
    ),
  );
  assert(
    mismatched === "CATEGORY_LAB_MISMATCH",
    `cross-lab category must be refused, got ${mismatched}`,
  );
  return { dormantParentBlocked: true, notFoundHandled: true, crossLabBlocked: true };
}

/**
 * Deletion is offered, but only while nothing depends on the row.
 *
 * `student_profiles` references department and programme with `onDelete:
 * Restrict`. Deleting either out from under a student would orphan their
 * record, so the service must refuse with an explanation instead of letting a
 * raw foreign-key error surface — and deactivation stays available.
 */
async function verifyReferenceDeletion(fixture: Fixture) {
  const department = await reference.createDepartment(
    { code: `P6D${runToken}`.toUpperCase().slice(0, 12), name: `${prefix} Deletable Dept` },
    fixture.admin,
  );
  const programme = await reference.createProgramme(
    {
      departmentId: department.id,
      code: `P6R${runToken}`.toUpperCase().slice(0, 12),
      name: `${prefix} Deletable Programme`,
    },
    fixture.admin,
  );

  // A programme nobody has chosen can simply go.
  await reference.deleteProgramme(programme.id, fixture.admin);
  assert(
    (await prisma.programme.findUnique({ where: { id: programme.id } })) === null,
    "an unused programme must be deletable",
  );

  // Now attach a student and prove both refusals.
  const held = await reference.createProgramme(
    {
      departmentId: department.id,
      code: `P6H${runToken}`.toUpperCase().slice(0, 12),
      name: `${prefix} Held Programme`,
    },
    fixture.admin,
  );
  const student = await prisma.user.create({
    data: {
      email: `${prefix}-holder@mitwpu.edu.in`,
      name: "Holder",
      roles: [UserRole.STUDENT],
      profileComplete: true,
      studentProfile: {
        create: {
          prn: `${runToken}HD`.toUpperCase().slice(0, 24),
          departmentId: department.id,
          programmeId: held.id,
          academicYear: 2,
        },
      },
    },
  });

  const programmeRefusal = await capture(() => reference.deleteProgramme(held.id, fixture.admin));
  assert(
    programmeRefusal === "PROGRAMME_IN_USE",
    `a programme in use must be refused, got ${programmeRefusal}`,
  );
  const departmentRefusal = await capture(() =>
    reference.deleteDepartment(department.id, fixture.admin),
  );
  assert(
    departmentRefusal === "DEPARTMENT_IN_USE",
    `a department in use must be refused, got ${departmentRefusal}`,
  );

  // Deactivation stays available while it is in use.
  await reference.updateDepartment(department.id, { isActive: false }, fixture.admin);
  const deactivated = await prisma.department.findUniqueOrThrow({ where: { id: department.id } });
  assert(!deactivated.isActive, "an in-use department must still be deactivatable");

  // Once the dependency is gone, deletion works and takes the programmes too.
  await prisma.studentProfile.delete({ where: { userId: student.id } });
  const result = await reference.deleteDepartment(department.id, fixture.admin);
  assert(
    result.removedProgrammes === 1,
    `its programmes must go with it, got ${result.removedProgrammes}`,
  );
  assert(
    (await prisma.department.findUnique({ where: { id: department.id } })) === null,
    "the department must be gone",
  );
  assert(
    (await prisma.programme.findUnique({ where: { id: held.id } })) === null,
    "its programme must be gone",
  );

  const audited = await prisma.auditLog.count({
    where: { action: { in: ["reference.department_deleted", "reference.programme_deleted"] } },
  });
  assert(audited >= 2, `deletions must be audited, got ${audited}`);
  return {
    unusedProgrammeDeleted: true,
    inUseRefused: [programmeRefusal, departmentRefusal],
    cascadedProgrammes: result.removedProgrammes,
  };
}

/** Every administrative write must leave an audit record. */
async function verifyAuditTrail(fixture: Fixture) {
  const page = await audit.list(
    { actorUserId: fixture.admin.id, page: 1, limit: 100 },
    fixture.admin,
  );
  const actions = page.data.map((row) => row.action);
  for (const expected of [
    "reference.department_created",
    "reference.department_updated",
    "reference.programme_created",
    "reference.consumable_created",
  ]) {
    assert(actions.includes(expected), `missing audit action ${expected}`);
  }
  assert(
    page.data.every((row) => row.actor?.id === fixture.admin.id),
    "actor filter must be honoured",
  );
  // Newest first.
  const timestamps = page.data.map((row) => Date.parse(row.createdAt));
  assert(
    timestamps.every((value, index) => index === 0 || timestamps[index - 1]! >= value),
    "audit log must be newest-first",
  );
  const distinct = await audit.actions(fixture.admin);
  assert(distinct.includes("reference.department_created"), "action facet must include writes");
  return { entries: page.meta.total, distinctActions: distinct.length };
}

/** The dashboard must return dense, non-negative counters in one call. */
async function verifyDashboard(fixture: Fixture) {
  const result = await dashboards.dashboard(fixture.labId, fixture.admin);
  assert(result.lab.id === fixture.labId, "dashboard must scope to the lab");
  for (const status of ["CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
    assert(
      typeof result.today.bookings[status] === "number",
      `booking status ${status} must always be present`,
    );
  }
  assert(result.live.occupancy >= 0, "occupancy cannot be negative");
  assert(
    result.lastSevenDays.noShowRate === null || result.lastSevenDays.noShowRate >= 0,
    "no-show rate must be null or non-negative",
  );
  assert(
    Object.values(result.projects).every((value) => value >= 0),
    "project counters must be non-negative",
  );
  const missing = await capture(() => dashboards.dashboard(crypto.randomUUID(), fixture.admin));
  assert(missing === "NOT_FOUND", `unknown lab must 404, got ${missing}`);
  return {
    statusesDense: Object.keys(result.today.bookings).length,
    occupancy: result.live.occupancy,
    noShowRate: result.lastSevenDays.noShowRate,
  };
}

/**
 * Regression: the daily window must be the lab's local day, not UTC midnight.
 *
 * For Asia/Kolkata the two differ by 5h30m. A booking at 01:00 IST belongs to
 * *today* locally but falls on the *previous* UTC date, so a naive comparison
 * silently drops an entire evening of bookings from the daily figures.
 */
async function verifyDashboardTimeZoneWindow(fixture: Fixture) {
  const lab = await prisma.lab.findUniqueOrThrow({ where: { id: fixture.labId } });
  const today = localToday(lab.timeZone);
  // 00:30 local — before UTC midnight for any positive-offset zone.
  const startsAt = zonedLocalMinuteToUtc(today, 30, lab.timeZone);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  assert(
    startsAt.toISOString().slice(0, 10) !== today,
    "fixture precondition: the local day must straddle a UTC date boundary",
  );

  const before = await dashboards.dashboard(fixture.labId, fixture.admin);
  const slot = await prisma.labSlot.create({
    data: {
      labId: lab.id,
      localDate: new Date(`${today}T00:00:00.000Z`),
      startsAt,
      endsAt,
      bookingCapacity: 5,
      quickVisitCapacity: 5,
      status: "OPEN",
    },
  });
  const project = await prisma.project.create({
    data: {
      labId: lab.id,
      title: `${prefix} tz project`,
      description: "timezone regression fixture",
      creatorId: fixture.admin.id,
      status: "VERIFIED",
      idempotencyKey: crypto.randomUUID(),
    },
  });
  await prisma.booking.create({
    data: {
      labId: lab.id,
      labSlotId: slot.id,
      projectId: project.id,
      createdById: fixture.admin.id,
      idempotencyKey: crypto.randomUUID(),
      creationRequestFingerprint: crypto.randomBytes(32).toString("hex"),
      attendeeCount: 1,
      status: "CONFIRMED",
      labNameSnapshot: lab.name,
      projectTitleSnapshot: project.title,
      slotStartsAtSnapshot: startsAt,
      slotEndsAtSnapshot: endsAt,
      timeZoneSnapshot: lab.timeZone,
      cancellationWindowHoursSnapshot: 0,
    },
  });

  const after = await dashboards.dashboard(fixture.labId, fixture.admin);
  assert(
    after.today.bookingsTotal === before.today.bookingsTotal + 1,
    `an early-morning local booking must count toward today: ${before.today.bookingsTotal} -> ${after.today.bookingsTotal}`,
  );
  assert(
    after.lastSevenDays.bookingsTotal === before.lastSevenDays.bookingsTotal + 1,
    "it must also count toward the seven-day window",
  );
  return {
    localDate: today,
    utcDate: startsAt.toISOString().slice(0, 10),
    countedToday: true,
  };
}

/** Export must stream a well-formed, audited CSV. */
async function verifyCsvExport(fixture: Fixture) {
  const { body, headers } = await collectCsv("audit-logs", {}, fixture.admin);
  assert(
    headers["Content-Type"] === "text/csv; charset=utf-8",
    `unexpected content type ${headers["Content-Type"]}`,
  );
  assert(
    String(headers["Content-Disposition"]).includes("attachment"),
    "export must be an attachment",
  );
  assert(headers["X-Content-Type-Options"] === "nosniff", "export must forbid MIME sniffing");
  assert(body.startsWith("\ufeff"), "export must carry a UTF-8 BOM for Excel");

  const lines = body
    .replace(/^\ufeff/, "")
    .trim()
    .split("\n");
  assert(lines[0]!.startsWith('"id"'), `unexpected header row ${lines[0]}`);
  assert(lines.length > 1, "export should contain the audit rows written above");
  // Every data row must have the same column count as the header.
  const expectedColumns = countColumns(lines[0]!);
  for (const line of lines.slice(1, 50)) {
    assert(
      countColumns(line) === expectedColumns,
      `ragged CSV row: expected ${expectedColumns} columns, got ${countColumns(line)}`,
    );
  }

  const exportAudit = await prisma.auditLog.findFirst({
    where: { actorUserId: fixture.admin.id, action: "report.exported" },
    orderBy: { createdAt: "desc" },
  });
  assert(Boolean(exportAudit), "an export must itself be audited");
  return { rows: lines.length - 1, columns: expectedColumns, audited: true };
}

/** Counts RFC 4180 columns, respecting quoted commas. */
function countColumns(line: string) {
  let count = 1;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) count += 1;
  }
  return count;
}

async function collectCsv(
  kind: Parameters<typeof streamCsv>[0],
  query: Parameters<typeof streamCsv>[1],
  viewer: Viewer,
) {
  const sink = new PassThrough();
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  sink.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

  // A PassThrough is a real writable stream, so `write`/`end`/backpressure all
  // behave exactly as they will against a socket; only `setHeader` is stubbed.
  const res = Object.assign(sink, {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  }) as unknown as Response;

  await streamCsv(kind, query, viewer, res);
  await new Promise((resolve) => sink.once("end", resolve));
  return { body: Buffer.concat(chunks).toString("utf8"), headers };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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
  const labs = await prisma.lab.findMany({
    where: { code: { startsWith: `P6L${runToken}`.toUpperCase() } },
    select: { id: true },
  });
  const labIds = labs.map((row) => row.id);
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${prefix}-` } },
    select: { id: true },
  });
  const userIds = users.map((row) => row.id);

  const bookings = await prisma.booking.findMany({
    where: { labId: { in: labIds } },
    select: { id: true },
  });
  await prisma.bookingEquipment.deleteMany({
    where: { bookingId: { in: bookings.map((row) => row.id) } },
  });
  await prisma.bookingStatusHistory.deleteMany({
    where: { bookingId: { in: bookings.map((row) => row.id) } },
  });
  await prisma.bookingParticipant.deleteMany({
    where: { bookingId: { in: bookings.map((row) => row.id) } },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookings.map((row) => row.id) } } });
  await prisma.project.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.labSlot.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.consumable.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.consumableCategory.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.equipmentCategory.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.programme.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.lab.deleteMany({ where: { id: { in: labIds } } });

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
