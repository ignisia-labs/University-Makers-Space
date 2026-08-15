import { z } from "zod";
import { dateFields, idParam, listQuery } from "../shared/schemas.js";

const baseBody = z
  .object({
    ...dateFields,
    labId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(2000),
    location: z.string().trim().min(2).max(160),
    capacity: z.number().int().min(1).max(1000),
  })
  .strict();

const createBody = baseBody.refine((v) => new Date(v.endTime) > new Date(v.startTime), {
  message: "endTime must be after startTime",
  path: ["endTime"],
});

export const listEventsSchema = z.object({
  query: listQuery.extend({ organizerId: z.string().uuid().optional() }).strict(),
});
export const createEventSchema = z.object({ body: createBody });
export const updateEventSchema = z.object({ params: idParam, body: baseBody.partial().strict() });
export const eventIdSchema = z.object({ params: idParam });
