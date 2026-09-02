import { AttendanceStatus, QuickVisitStatus, VisitSource } from "@prisma/client";
import { z } from "zod";
import { idParam } from "../shared/schemas.js";

const uuid = z.string().uuid();
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be an ISO calendar date (YYYY-MM-DD)");

export const createQuickVisitSchema = z.object({
  body: z
    .object({
      labSlotId: uuid,
      purpose: z.string().trim().min(3).max(280),
      idempotencyKey: uuid,
    })
    .strict(),
});

export const listQuickVisitsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      labId: uuid.optional(),
      labSlotId: uuid.optional(),
      userId: uuid.optional(),
      status: z.nativeEnum(QuickVisitStatus).optional(),
      scope: z.enum(["upcoming", "past", "all"]).default("all"),
    })
    .strict(),
});

export const decideQuickVisitSchema = z.object({
  params: idParam,
  body: z
    .object({
      decision: z.enum(["APPROVED", "REJECTED"]),
      reason: z.string().trim().min(3).max(500).nullable().optional(),
    })
    .strict()
    .refine((value) => value.decision !== "REJECTED" || Boolean(value.reason), {
      message: "A reason is required when rejecting a Quick Visit",
      path: ["reason"],
    }),
});

export const cancelQuickVisitSchema = z.object({
  params: idParam,
  body: z
    .object({
      reason: z.string().trim().min(3).max(500),
      idempotencyKey: uuid,
    })
    .strict(),
});

export const checkInSchema = z.object({
  body: z.discriminatedUnion("source", [
    z
      .object({
        source: z.literal(VisitSource.BOOKING),
        bookingId: uuid,
        userId: uuid,
        idempotencyKey: uuid,
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .strict(),
    z
      .object({
        source: z.literal(VisitSource.QUICK_VISIT),
        quickVisitId: uuid,
        idempotencyKey: uuid,
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .strict(),
  ]),
});

export const checkOutSchema = z.object({
  params: idParam,
  body: z
    .object({
      idempotencyKey: uuid,
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .strict(),
});

export const listVisitsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      labId: uuid.optional(),
      userId: uuid.optional(),
      bookingId: uuid.optional(),
      projectId: uuid.optional(),
      status: z.nativeEnum(AttendanceStatus).optional(),
      source: z.nativeEnum(VisitSource).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .strict()
    .refine((value) => !value.from || !value.to || new Date(value.to) >= new Date(value.from), {
      message: "`to` must be on or after `from`",
      path: ["to"],
    }),
});

export const visitIdSchema = z.object({ params: idParam });

export const labConsoleSchema = z.object({
  params: z.object({ labId: uuid }).strict(),
  query: z.object({ date: localDate.optional() }).strict(),
});

export const labOccupancySchema = z.object({
  params: z.object({ labId: uuid }).strict(),
  query: z.object({}).strict(),
});
