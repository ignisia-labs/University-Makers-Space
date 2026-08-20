import { z } from "zod";
import { paginationSchema } from "../../utils/pagination.js";

export const idParam = z.object({ id: z.string().uuid() }).strict();
export const idParamsSchema = z.object({ params: idParam });

export const listQuery = paginationSchema
  .extend({
    status: z.string().trim().max(60).optional(),
    category: z.string().trim().max(80).optional(),
  })
  .strict();

export const listSchema = z.object({ query: listQuery });

export const dateFields = {
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
};

export const dateRange = z
  .object(dateFields)
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
