import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./lab-controller.js";
import {
  availabilityDatesSchema,
  dailyAvailabilitySchema,
  deleteLabDateExceptionSchema,
  labConfigurationSchema,
  regenerateLabSlotsSchema,
  updateLabConfigurationSchema,
  upsertLabDateExceptionSchema,
} from "./lab-schema.js";

export const labRoutes = Router();

labRoutes.use(authenticate);
labRoutes.get(
  "/:labId/availability/dates",
  authorize("lab.availability.read"),
  validate(availabilityDatesSchema),
  asyncHandler(controller.availabilityDates),
);
labRoutes.get(
  "/:labId/availability",
  authorize("lab.availability.read"),
  validate(dailyAvailabilitySchema),
  asyncHandler(controller.dailyAvailability),
);
labRoutes.get(
  "/:labId/configuration",
  authorize("lab.configure"),
  validate(labConfigurationSchema),
  asyncHandler(controller.configuration),
);
labRoutes.put(
  "/:labId/configuration",
  authorize("lab.configure"),
  validate(updateLabConfigurationSchema),
  asyncHandler(controller.updateConfiguration),
);
labRoutes.put(
  "/:labId/date-exceptions",
  authorize("lab.configure"),
  validate(upsertLabDateExceptionSchema),
  asyncHandler(controller.upsertDateException),
);
labRoutes.delete(
  "/:labId/date-exceptions/:exceptionId",
  authorize("lab.configure"),
  validate(deleteLabDateExceptionSchema),
  asyncHandler(controller.deleteDateException),
);
labRoutes.post(
  "/:labId/slots/regenerate",
  authorize("lab.configure"),
  validate(regenerateLabSlotsSchema),
  asyncHandler(controller.regenerateSlots),
);
