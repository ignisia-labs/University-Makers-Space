import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./visit-controller.js";
import {
  cancelQuickVisitSchema,
  checkInSchema,
  checkOutSchema,
  createQuickVisitSchema,
  decideQuickVisitSchema,
  listQuickVisitsSchema,
  listVisitsSchema,
  visitIdSchema,
} from "./visit-schema.js";

/**
 * Attendance writes are front-desk actions: a Lab Assistant may legitimately
 * fire many in a burst while a queue clears, so the ceiling is generous but
 * still bounded per operator.
 */
const attendanceLimiter = rateLimit({ prefix: "attendance-mutation", windowSeconds: 60, max: 120 });
const quickVisitLimiter = rateLimit({ prefix: "quick-visit-mutation", windowSeconds: 60, max: 20 });

export const quickVisitRoutes = Router();
quickVisitRoutes.use(authenticate);
quickVisitRoutes.get(
  "/",
  authorize("visit.read.own"),
  validate(listQuickVisitsSchema),
  asyncHandler(controller.listQuickVisits),
);
quickVisitRoutes.post(
  "/",
  authorize("visit.create"),
  quickVisitLimiter,
  validate(createQuickVisitSchema),
  asyncHandler(controller.createQuickVisit),
);
quickVisitRoutes.get(
  "/:id",
  authorize("visit.read.own"),
  validate(visitIdSchema),
  asyncHandler(controller.getQuickVisit),
);
quickVisitRoutes.post(
  "/:id/decision",
  authorize("quick_visit.decide"),
  attendanceLimiter,
  validate(decideQuickVisitSchema),
  asyncHandler(controller.decideQuickVisit),
);
quickVisitRoutes.post(
  "/:id/cancel",
  quickVisitLimiter,
  validate(cancelQuickVisitSchema),
  asyncHandler(controller.cancelQuickVisit),
);

export const visitRoutes = Router();
visitRoutes.use(authenticate);
visitRoutes.get(
  "/",
  authorize("visit.read.own"),
  validate(listVisitsSchema),
  asyncHandler(controller.listVisits),
);
visitRoutes.post(
  "/check-in",
  authorize("visit.check_in"),
  attendanceLimiter,
  validate(checkInSchema),
  asyncHandler(controller.checkIn),
);
visitRoutes.get(
  "/:id",
  authorize("visit.read.own"),
  validate(visitIdSchema),
  asyncHandler(controller.getVisit),
);
visitRoutes.post(
  "/:id/check-out",
  authorize("visit.check_out"),
  attendanceLimiter,
  validate(checkOutSchema),
  asyncHandler(controller.checkOut),
);
