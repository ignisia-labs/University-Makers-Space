import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./notification-controller.js";
import {
  createNotificationSchema,
  listNotificationsSchema,
  readSchema,
} from "./notification-schema.js";

export const notificationRoutes = Router();

notificationRoutes.get(
  "/",
  authenticate,
  validate(listNotificationsSchema),
  asyncHandler(controller.list),
);
notificationRoutes.post(
  "/",
  authenticate,
  authorize("notification.create"),
  validate(createNotificationSchema),
  asyncHandler(controller.create),
);
notificationRoutes.patch(
  "/:id/read",
  authenticate,
  validate(readSchema),
  asyncHandler(controller.markRead),
);
