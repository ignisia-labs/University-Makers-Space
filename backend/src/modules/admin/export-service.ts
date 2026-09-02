import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import type { Viewer } from "../visits/visit-shared.js";

export const exportKinds = [
  "bookings",
  "visits",
  "quick-visits",
  "projects",
  "audit-logs",
] as const;
export type ExportKind = (typeof exportKinds)[number];

/** Rows fetched per keyset page. Large enough to be efficient, small enough
 *  that a single page never dominates memory. */
const PAGE_SIZE = 1_000;
/** Hard ceiling on one export. Beyond this the caller must narrow the range —
 *  an unbounded export is an availability risk, not a feature. */
const MAX_ROWS = 100_000;

type ExportQuery = {
  labId?: string;
  from?: string;
  to?: string;
};

/**
 * Streams a report as CSV.
 *
 * Rows are pulled by keyset pagination (`id > cursor`) rather than OFFSET, so
 * cost stays flat as the export grows, and each page is written to the socket
 * and released before the next is fetched — memory stays constant regardless of
 * how many rows the range contains.
 */
export async function streamCsv(
  kind: ExportKind,
  query: ExportQuery,
  viewer: Viewer,
  res: Response,
) {
  const definition = definitions[kind];
  if (!definition) throw new ApiError(400, "UNKNOWN_EXPORT", "Unknown export type");

  const filename = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  // The payload is user-influenced data; never let a browser sniff it as HTML.
  res.setHeader("X-Content-Type-Options", "nosniff");

  // A BOM so Excel opens UTF-8 (student names carry diacritics) correctly.
  res.write("\ufeff");
  res.write(`${definition.headers.map(csvCell).join(",")}\n`);

  let cursor: string | undefined;
  let written = 0;
  for (;;) {
    const rows = await definition.fetch(query, cursor, PAGE_SIZE);
    if (!rows.length) break;
    for (const row of rows) {
      res.write(`${definition.toLine(row).map(csvCell).join(",")}\n`);
      written += 1;
    }
    cursor = rows.at(-1)!.id;
    if (rows.length < PAGE_SIZE || written >= MAX_ROWS) break;
    // Respect backpressure: if the socket buffer is full, wait for it to drain
    // instead of queueing the whole report in memory.
    if (res.writableNeedDrain) {
      await new Promise((resolve) => res.once("drain", resolve));
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: viewer.id,
      action: "report.exported",
      entityType: "Report",
      entityId: kind,
      metadata: { rows: written, truncated: written >= MAX_ROWS, ...query },
    },
  });
  res.end();
  return written;
}

/**
 * Renders one CSV cell.
 *
 * Beyond RFC 4180 quoting, this neutralises spreadsheet formula injection: a
 * cell beginning with `=`, `+`, `-`, `@`, or a leading tab/CR is executed by
 * Excel, Sheets and LibreOffice on open. Prefixing with an apostrophe keeps the
 * text readable while forcing it to be treated as a literal.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const neutralised = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralised.replaceAll('"', '""')}"`;
}

function range(query: ExportQuery, field: string): Prisma.DateTimeFilter | undefined {
  if (!query.from && !query.to) return undefined;
  void field;
  return {
    ...(query.from ? { gte: new Date(query.from) } : {}),
    ...(query.to ? { lte: new Date(query.to) } : {}),
  };
}

type Row = { id: string };
type Definition = {
  headers: string[];
  fetch: (query: ExportQuery, cursor: string | undefined, take: number) => Promise<Row[]>;
  toLine: (row: Row) => unknown[];
};

/**
 * Pairs a row type with its fetcher and its formatter. The single cast here is
 * sound because both halves are declared against the same `T`; erasing it once
 * keeps every definition below fully type-checked against its Prisma model.
 */
function define<T extends Row>(definition: {
  headers: string[];
  fetch: (query: ExportQuery, cursor: string | undefined, take: number) => Promise<T[]>;
  toLine: (row: T) => unknown[];
}): Definition {
  return definition as unknown as Definition;
}

const definitions: Record<ExportKind, Definition> = {
  bookings: define({
    headers: [
      "id",
      "project",
      "lab",
      "status",
      "attendees",
      "startsAt",
      "endsAt",
      "createdAt",
      "cancelledAt",
      "cancellationSource",
      "cancellationReason",
    ],
    fetch: (query, cursor, take) =>
      prisma.booking.findMany({
        where: {
          ...(query.labId ? { labId: query.labId } : {}),
          ...(range(query, "slotStartsAtSnapshot")
            ? { slotStartsAtSnapshot: range(query, "slotStartsAtSnapshot") }
            : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take,
      }),
    toLine: (row: Prisma.BookingGetPayload<Record<string, never>>) => [
      row.id,
      row.projectTitleSnapshot,
      row.labNameSnapshot,
      row.status,
      row.attendeeCount,
      row.slotStartsAtSnapshot,
      row.slotEndsAtSnapshot,
      row.createdAt,
      row.cancelledAt,
      row.cancellationSource,
      row.cancellationReason,
    ],
  }),
  visits: define({
    headers: [
      "id",
      "visitor",
      "email",
      "prn",
      "lab",
      "project",
      "source",
      "status",
      "expectedStartAt",
      "expectedEndAt",
      "checkedInAt",
      "checkedOutAt",
      "lateByMinutes",
      "overstayByMinutes",
      "closeReason",
    ],
    fetch: (query, cursor, take) =>
      prisma.visit.findMany({
        where: {
          ...(query.labId ? { labId: query.labId } : {}),
          ...(range(query, "checkedInAt") ? { checkedInAt: range(query, "checkedInAt") } : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take,
      }),
    toLine: (row: Prisma.VisitGetPayload<Record<string, never>>) => [
      row.id,
      row.userNameSnapshot,
      row.userEmailSnapshot,
      row.userPrnSnapshot,
      row.labNameSnapshot,
      row.projectTitleSnapshot,
      row.source,
      row.status,
      row.expectedStartAt,
      row.expectedEndAt,
      row.checkedInAt,
      row.checkedOutAt,
      row.lateByMinutes,
      row.overstayByMinutes,
      row.closeReason,
    ],
  }),
  "quick-visits": define({
    headers: [
      "id",
      "visitor",
      "email",
      "prn",
      "lab",
      "purpose",
      "status",
      "startsAt",
      "endsAt",
      "decidedAt",
      "cancelledAt",
      "cancellationReason",
    ],
    fetch: (query, cursor, take) =>
      prisma.quickVisit.findMany({
        where: {
          ...(query.labId ? { labId: query.labId } : {}),
          ...(range(query, "slotStartsAtSnapshot")
            ? { slotStartsAtSnapshot: range(query, "slotStartsAtSnapshot") }
            : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take,
      }),
    toLine: (row: Prisma.QuickVisitGetPayload<Record<string, never>>) => [
      row.id,
      row.userNameSnapshot,
      row.userEmailSnapshot,
      row.userPrnSnapshot,
      row.labNameSnapshot,
      row.purpose,
      row.status,
      row.slotStartsAtSnapshot,
      row.slotEndsAtSnapshot,
      row.decidedAt,
      row.cancelledAt,
      row.cancellationReason,
    ],
  }),
  projects: define({
    headers: ["id", "title", "status", "domain", "createdAt", "updatedAt", "rejectionReason"],
    fetch: (query, cursor, take) =>
      prisma.project.findMany({
        where: {
          deletedAt: null,
          ...(query.labId ? { labId: query.labId } : {}),
          ...(range(query, "createdAt") ? { createdAt: range(query, "createdAt") } : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take,
      }),
    toLine: (row: Prisma.ProjectGetPayload<Record<string, never>>) => [
      row.id,
      row.title,
      row.status,
      row.domain,
      row.createdAt,
      row.updatedAt,
      row.rejectionReason,
    ],
  }),
  "audit-logs": define({
    headers: [
      "id",
      "createdAt",
      "action",
      "entityType",
      "entityId",
      "actorId",
      "ipAddress",
      "requestId",
    ],
    fetch: (query, cursor, take) =>
      prisma.auditLog.findMany({
        where: {
          ...(range(query, "createdAt") ? { createdAt: range(query, "createdAt") } : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take,
      }),
    toLine: (row: Prisma.AuditLogGetPayload<Record<string, never>>) => [
      row.id,
      row.createdAt,
      row.action,
      row.entityType,
      row.entityId,
      row.actorUserId,
      row.ipAddress,
      row.requestId,
    ],
  }),
};
