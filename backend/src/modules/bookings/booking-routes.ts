import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./booking-controller.js";
import {
  bookingIdSchema,
  cancelBookingSchema,
  createBookingSchema,
  listBookingsSchema,
  updateBookingStatusSchema,
} from "./booking-schema.js";

export const bookingRoutes = Router();
const bookingMutationLimiter = rateLimit({
  prefix: "booking-mutation",
  windowSeconds: 60,
  max: 30,
});

bookingRoutes.get("/", authenticate, validate(listBookingsSchema), asyncHandler(controller.list));
bookingRoutes.get("/:id", authenticate, validate(bookingIdSchema), asyncHandler(controller.get));
bookingRoutes.post(
  "/",
  authenticate,
  authorize("booking.create"),
  bookingMutationLimiter,
  validate(createBookingSchema),
  asyncHandler(controller.create),
);
bookingRoutes.post(
  "/:id/cancel",
  authenticate,
  bookingMutationLimiter,
  validate(cancelBookingSchema),
  asyncHandler(controller.cancel),
);
bookingRoutes.patch(
  "/:id/status",
  authenticate,
  authorize("booking.manage"),
  validate(updateBookingStatusSchema),
  asyncHandler(controller.updateStatus),
);
