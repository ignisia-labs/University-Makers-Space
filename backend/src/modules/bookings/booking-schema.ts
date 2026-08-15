import { z } from "zod";
import { dateFields, idParam, listQuery } from "../shared/schemas.js";

const status = z.enum(["pending", "approved", "active", "completed", "cancelled", "rejected", "no_show"]);

export const listBookingsSchema = z.object({ query: listQuery.extend({ userId: z.string().uuid().optional(), equipmentId: z.string().uuid().optional() }) });

export const createBookingSchema = z.object({
  body: z.object({
    ...dateFields,
    equipmentId: z.string().uuid(),
    notes: z.string().trim().max(500).nullable().optional(),
  }).strict().refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  }),
});

export const updateBookingStatusSchema = z.object({
  params: idParam,
  body: z.object({ status, notes: z.string().trim().max(500).nullable().optional() }).strict(),
});

export const bookingIdSchema = z.object({ params: idParam });
