import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { idParam } from "../shared/schemas.js";

export const listBookingsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      labSlotId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      status: z.nativeEnum(BookingStatus).optional(),
      scope: z.enum(["upcoming", "past", "all"]).default("all"),
    })
    .strict(),
});

export const createBookingSchema = z.object({
  body: z
    .object({
      labSlotId: z.string().uuid(),
      projectId: z.string().uuid(),
      participantIds: z.array(z.string().uuid()).min(1).max(500),
      idempotencyKey: z.string().uuid(),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .strict()
    .refine((value) => new Set(value.participantIds).size === value.participantIds.length, {
      message: "participantIds must be unique",
      path: ["participantIds"],
    }),
});

export const cancelBookingSchema = z.object({
  params: idParam,
  body: z
    .object({
      reason: z.string().trim().min(3).max(500),
      idempotencyKey: z.string().uuid(),
    })
    .strict(),
});

export const updateBookingStatusSchema = z.object({
  params: idParam,
  body: z
    .object({
      status: z.union([
        z.literal(BookingStatus.ACTIVE),
        z.literal(BookingStatus.COMPLETED),
        z.literal(BookingStatus.NO_SHOW),
      ]),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .strict(),
});

export const bookingIdSchema = z.object({ params: idParam });
