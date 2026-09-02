import crypto from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { ApiError } from "../../utils/api-error.js";

export const maxTransactionAttempts = 3;
export const maxSerializationBackoffMs = 150;

/**
 * How long before a slot opens a participant may already be admitted. Arriving
 * inside this window is punctual, not early — it exists so the queue at the
 * door does not have to wait for the clock to tick over.
 */
export const earlyCheckInMinutes = 15;

export type Viewer = NonNullable<Express.Request["user"]>;
export type RequestContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export function fingerprint(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

export function isSerializationConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  const sqlState = typeof error.meta?.code === "string" ? error.meta.code : null;
  return error.code === "P2010" && (sqlState === "40001" || sqlState === "40P01");
}

export function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Prisma reports a unique violation as the *column list* of the offending index
 * (e.g. `["lab_slot_id", "user_id"]`), not the index name — and that holds for
 * hand-written partial indexes too. `violatedColumns` normalises it to a sorted
 * set so call sites can match an index exactly rather than by substring, which
 * would misfire the moment two indexes share a column.
 */
export function violatedColumns(error: unknown): ReadonlySet<string> {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return new Set();
  const target = error.meta?.target;
  if (typeof target === "string") return new Set(target.split(",").map((part) => part.trim()));
  if (Array.isArray(target)) return new Set(target.map((part) => String(part)));
  return new Set();
}

/** True when the violated index is exactly the given column set. */
export function violated(error: unknown, ...columns: string[]) {
  const actual = violatedColumns(error);
  return actual.size === columns.length && columns.every((column) => actual.has(column));
}

export async function waitForSerializationRetry(attempt: number) {
  const ceiling = Math.min(maxSerializationBackoffMs, 10 * 2 ** attempt);
  const delayMs = Math.max(1, Math.floor(Math.random() * ceiling));
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5_000,
  timeout: 10_000,
} as const;

export function primaryRole(roles: UserRole[]) {
  const priority = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.LAB_ASSISTANT,
    UserRole.FACULTY_MENTOR,
    UserRole.STUDENT,
  ];
  return priority.find((role) => roles.includes(role)) ?? UserRole.STUDENT;
}

export async function lockSlot(tx: Prisma.TransactionClient, labSlotId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "lab_slots" WHERE id = ${labSlotId}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "MakerSpace slot not found");
}

export async function lockQuickVisit(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "quick_visits" WHERE id = ${id}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "Quick Visit not found");
}

export async function lockBooking(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "bookings" WHERE id = ${id}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "Booking not found");
}

export async function lockVisit(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "visits" WHERE id = ${id}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "Visit not found");
}

export function formatWindow(startsAt: Date, endsAt: Date, timeZone: string) {
  const start = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(startsAt);
  const end = new Intl.DateTimeFormat("en-IN", { timeZone, timeStyle: "short" }).format(endsAt);
  return `${start}–${end}`;
}
