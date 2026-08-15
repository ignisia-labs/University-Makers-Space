import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./booking-controller.js";
import { bookingIdSchema, createBookingSchema, listBookingsSchema, updateBookingStatusSchema } from "./booking-schema.js";

export const bookingRoutes = Router();

bookingRoutes.get("/", authenticate, validate(listBookingsSchema), asyncHandler(controller.list));
bookingRoutes.get("/:id", authenticate, validate(bookingIdSchema), asyncHandler(controller.get));
bookingRoutes.post("/", authenticate, authorize("student", "admin", "staff"), validate(createBookingSchema), asyncHandler(controller.create));
bookingRoutes.patch("/:id/status", authenticate, authorize("admin", "staff"), validate(updateBookingStatusSchema), asyncHandler(controller.updateStatus));
