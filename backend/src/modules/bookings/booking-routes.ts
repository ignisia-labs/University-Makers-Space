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
// Ending your own session. Authorisation is ownership plus an ACTIVE status,
// both checked in the service, so no staff permission applies here.
bookingRoutes.post(
  "/:id/complete",
  authenticate,
  bookingMutationLimiter,
  validate(bookingIdSchema),
  asyncHandler(controller.complete),
);
bookingRoutes.patch(
  "/:id/status",
  authenticate,
  authorize("booking.manage"),
  bookingMutationLimiter,
  validate(updateBookingStatusSchema),
  asyncHandler(controller.updateStatus),
);
