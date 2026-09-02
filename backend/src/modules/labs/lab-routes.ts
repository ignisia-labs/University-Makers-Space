import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as adminController from "../admin/admin-controller.js";
import { dashboardSchema } from "../admin/admin-schema.js";
import * as visitController from "../visits/visit-controller.js";
import { labConsoleSchema, labOccupancySchema } from "../visits/visit-schema.js";
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
const availabilityLimiter = rateLimit({
  prefix: "lab-availability",
  windowSeconds: 60,
  max: 120,
});

labRoutes.use(authenticate);
labRoutes.get(
  "/:labId/availability/dates",
  authorize("lab.availability.read"),
  availabilityLimiter,
  validate(availabilityDatesSchema),
  asyncHandler(controller.availabilityDates),
);
labRoutes.get(
  "/:labId/availability",
  authorize("lab.availability.read"),
  availabilityLimiter,
  validate(dailyAvailabilitySchema),
  asyncHandler(controller.dailyAvailability),
);
// Phase 5 operations. `/console` is deliberately one call: it returns the whole
// operating day plus live occupancy so the console never fans out per booking.
labRoutes.get(
  "/:labId/occupancy",
  authorize("visit.read.operational"),
  availabilityLimiter,
  validate(labOccupancySchema),
  asyncHandler(visitController.occupancy),
);
labRoutes.get(
  "/:labId/dashboard",
  authorize("dashboard.read"),
  availabilityLimiter,
  validate(dashboardSchema),
  asyncHandler(adminController.dashboard),
);
labRoutes.get(
  "/:labId/console",
  authorize("lab.console.read"),
  availabilityLimiter,
  validate(labConsoleSchema),
  asyncHandler(visitController.roster),
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
