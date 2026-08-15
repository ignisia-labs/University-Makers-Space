import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./event-controller.js";
import { createEventSchema, eventIdSchema, listEventsSchema, updateEventSchema } from "./event-schema.js";

export const eventRoutes = Router();

eventRoutes.get("/", authenticate, validate(listEventsSchema), asyncHandler(controller.list));
eventRoutes.get("/:id", authenticate, validate(eventIdSchema), asyncHandler(controller.get));
eventRoutes.post("/", authenticate, authorize("admin", "staff"), validate(createEventSchema), asyncHandler(controller.create));
eventRoutes.patch("/:id", authenticate, authorize("admin", "staff"), validate(updateEventSchema), asyncHandler(controller.update));
eventRoutes.post("/:id/registrations", authenticate, validate(eventIdSchema), asyncHandler(controller.register));
eventRoutes.delete("/:id", authenticate, authorize("admin"), validate(eventIdSchema), asyncHandler(controller.remove));
