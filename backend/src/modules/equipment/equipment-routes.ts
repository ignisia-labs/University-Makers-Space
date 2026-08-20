import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./equipment-controller.js";
import {
  createEquipmentSchema,
  equipmentIdSchema,
  listEquipmentSchema,
  updateEquipmentAvailabilitySchema,
  updateEquipmentSchema,
} from "./equipment-schema.js";

export const equipmentRoutes = Router();

equipmentRoutes.get(
  "/",
  authenticate,
  validate(listEquipmentSchema),
  asyncHandler(controller.list),
);
equipmentRoutes.get(
  "/:id",
  authenticate,
  validate(equipmentIdSchema),
  asyncHandler(controller.get),
);
equipmentRoutes.post(
  "/",
  authenticate,
  authorize("equipment.manage"),
  validate(createEquipmentSchema),
  asyncHandler(controller.create),
);
equipmentRoutes.patch(
  "/:id/availability",
  authenticate,
  authorize("equipment.availability.manage"),
  validate(updateEquipmentAvailabilitySchema),
  asyncHandler(controller.updateAvailability),
);
equipmentRoutes.patch(
  "/:id",
  authenticate,
  authorize("equipment.manage"),
  validate(updateEquipmentSchema),
  asyncHandler(controller.update),
);
equipmentRoutes.delete(
  "/:id",
  authenticate,
  authorize("equipment.manage"),
  validate(equipmentIdSchema),
  asyncHandler(controller.remove),
);
