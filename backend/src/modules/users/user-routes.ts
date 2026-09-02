import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./user-controller.js";
import {
  listUsersSchema,
  mentorDirectorySchema,
  provisioningSchema,
  updateProvisioningSchema,
  updateRolesSchema,
  updateUserSchema,
  updateOwnStudentProfileSchema,
  studentDirectorySearchSchema,
  userIdSchema,
} from "./user-schema.js";

export const userRoutes = Router();
const directorySearchLimiter = rateLimit({
  prefix: "directory-search",
  windowSeconds: 60,
  max: 60,
});

userRoutes.use(authenticate);
userRoutes.get(
  "/search/students",
  authorize("project.create"),
  directorySearchLimiter,
  validate(studentDirectorySearchSchema),
  asyncHandler(controller.searchStudents),
);
userRoutes.get(
  "/search/faculty-mentors",
  authorize("project.create"),
  directorySearchLimiter,
  validate(mentorDirectorySchema),
  asyncHandler(controller.searchFacultyMentors),
);
userRoutes.patch(
  "/me/student-profile",
  authorize("profile.complete"),
  validate(updateOwnStudentProfileSchema),
  asyncHandler(controller.updateOwnStudentProfile),
);
userRoutes.get(
  "/provisioning",
  authorize("user.roles.manage"),
  validate(listUsersSchema),
  asyncHandler(controller.listProvisioning),
);
userRoutes.post(
  "/provisioning",
  authorize("user.roles.manage"),
  validate(provisioningSchema),
  asyncHandler(controller.createProvisioning),
);
userRoutes.patch(
  "/provisioning/:id",
  authorize("user.roles.manage"),
  validate(updateProvisioningSchema),
  asyncHandler(controller.updateProvisioning),
);
userRoutes.get(
  "/",
  authorize("user.read"),
  validate(listUsersSchema),
  asyncHandler(controller.list),
);
userRoutes.get(
  "/:id",
  authorize("user.read"),
  validate(userIdSchema),
  asyncHandler(controller.get),
);
userRoutes.patch(
  "/:id",
  authorize("user.manage"),
  validate(updateUserSchema),
  asyncHandler(controller.update),
);
userRoutes.patch(
  "/:id/roles",
  authorize("user.roles.manage"),
  validate(updateRolesSchema),
  asyncHandler(controller.updateRoles),
);
userRoutes.post(
  "/:id/unlink-google",
  authorize("user.roles.manage"),
  validate(userIdSchema),
  asyncHandler(controller.unlinkGoogleIdentity),
);
userRoutes.delete(
  "/:id",
  authorize("user.manage"),
  validate(userIdSchema),
  asyncHandler(controller.remove),
);
