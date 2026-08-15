import { z } from "zod";
import { idParam, listQuery } from "../shared/schemas.js";

const status = z.enum([
  "available",
  "partially_available",
  "in_use",
  "reserved",
  "unavailable",
  "under_maintenance",
  "damaged",
  "out_of_service",
]);

const body = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(1000),
  category: z.string().trim().min(2).max(80),
  status: status.default("available"),
  imageUrl: z.string().url().nullable().optional(),
  totalQuantity: z.number().int().min(0).default(1),
  availableQuantity: z.number().int().min(0).default(1),
  specs: z.array(z.string().trim().min(1).max(120)).default([]),
  visible: z.boolean().default(true),
}).strict();

export const listEquipmentSchema = z.object({ query: listQuery });
export const createEquipmentSchema = z.object({ body });
export const updateEquipmentSchema = z.object({ params: idParam, body: body.partial().strict() });
export const equipmentIdSchema = z.object({ params: idParam });
