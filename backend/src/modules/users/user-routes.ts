import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./user-controller.js";
import { listUsersSchema, updateUserSchema, userIdSchema } from "./user-schema.js";

export const userRoutes = Router();

userRoutes.use(authenticate, authorize("admin"));
userRoutes.get("/", validate(listUsersSchema), asyncHandler(controller.list));
userRoutes.get("/:id", validate(userIdSchema), asyncHandler(controller.get));
userRoutes.patch("/:id", validate(updateUserSchema), asyncHandler(controller.update));
userRoutes.delete("/:id", validate(userIdSchema), asyncHandler(controller.remove));
