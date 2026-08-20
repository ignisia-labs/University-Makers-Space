import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { idParam, listQuery } from "../shared/schemas.js";

export const listBookingsSchema = z.object({
  query: listQuery
    .extend({
      labSlotId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    })
    .strict(),
});

export const createBookingSchema = z.object({
  body: z
    .object({
      labSlotId: z.string().uuid(),
      projectId: z.string().uuid(),
      participantIds: z.array(z.string().uuid()).min(1).max(20),
      equipment: z
        .array(
          z.object({ equipmentId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }),
        )
        .max(30)
        .default([]),
      consumables: z
        .array(
          z.object({
            consumableId: z.string().uuid(),
            expectedQuantity: z.number().positive().max(100_000).optional(),
          }),
        )
        .max(50)
        .default([]),
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
  body: z.object({ reason: z.string().trim().min(3).max(500) }).strict(),
});

export const updateBookingStatusSchema = z.object({
  params: idParam,
  body: z
    .object({
      status: z.nativeEnum(BookingStatus),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .strict(),
});

export const bookingIdSchema = z.object({ params: idParam });
