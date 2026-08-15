import { z } from "zod";

export const programmesQuerySchema = z.object({
  query: z.object({ departmentId: z.string().uuid().optional() }).strict(),
});

export const equipmentCategoriesQuerySchema = z.object({
  query: z.object({ labId: z.string().uuid().optional() }).strict(),
});
