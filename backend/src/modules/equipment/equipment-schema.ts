import { EquipmentStatus } from "@prisma/client";
import { z } from "zod";
import { idParam, listQuery } from "../shared/schemas.js";

const status = z.nativeEnum(EquipmentStatus);

const body = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(1000),
    labId: z.string().uuid(),
    categoryId: z.string().uuid(),
    domainId: z.string().uuid().nullable().optional(),
    status: status.default(EquipmentStatus.AVAILABLE),
    imageUrl: z.string().url().nullable().optional(),
    totalQuantity: z.number().int().min(0).default(1),
    availableQuantity: z.number().int().min(0).default(1),
    specs: z.array(z.string().trim().min(1).max(120)).default([]),
    visible: z.boolean().default(true),
  })
  .strict();
const createBody = body.refine((value) => value.availableQuantity <= value.totalQuantity, {
  message: "availableQuantity cannot exceed totalQuantity",
  path: ["availableQuantity"],
});

export const listEquipmentSchema = z.object({
  query: listQuery.extend({
    labId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
  }),
});
export const createEquipmentSchema = z.object({ body: createBody });
export const updateEquipmentSchema = z.object({ params: idParam, body: body.partial().strict() });
export const updateEquipmentAvailabilitySchema = z.object({
  params: idParam,
  body: z
    .object({
      status: status.optional(),
      availableQuantity: z.number().int().min(0).optional(),
      // A photo of the machine is operational information: the person who works
      // beside it every day is the right one to keep it current. Allowing it
      // here rather than granting `equipment.manage` means a Lab Assistant can
      // photograph a machine without also being able to rename or delete it.
      imageUrl: z.string().url().max(2000).nullable().optional(),
      reason: z.string().trim().min(3).max(500),
    })
    .strict()
    .refine(
      (value) =>
        value.status !== undefined ||
        value.availableQuantity !== undefined ||
        value.imageUrl !== undefined,
      {
        message: "Provide status, availableQuantity or imageUrl",
        path: ["status"],
      },
    ),
});
export const equipmentIdSchema = z.object({ params: idParam });
