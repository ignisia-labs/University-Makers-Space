import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./project-controller.js";
import {
  createProjectSchema,
  listProjectsSchema,
  memberSchema,
  mentorDecisionSchema,
  mentorRequestSchema,
  projectIdSchema,
  updateProjectSchema,
} from "./project-schema.js";

export const projectRoutes = Router();

projectRoutes.get("/", authenticate, validate(listProjectsSchema), asyncHandler(controller.list));
projectRoutes.get("/:id", authenticate, validate(projectIdSchema), asyncHandler(controller.get));
projectRoutes.post(
  "/",
  authenticate,
  authorize("project.create"),
  validate(createProjectSchema),
  asyncHandler(controller.create),
);
projectRoutes.patch(
  "/:id",
  authenticate,
  validate(updateProjectSchema),
  asyncHandler(controller.update),
);
projectRoutes.post(
  "/:id/members",
  authenticate,
  validate(memberSchema),
  asyncHandler(controller.addMember),
);
projectRoutes.post(
  "/:id/mentor-requests",
  authenticate,
  validate(mentorRequestSchema),
  asyncHandler(controller.requestMentor),
);
projectRoutes.post(
  "/:id/mentor-decision",
  authenticate,
  authorize("project.approve"),
  validate(mentorDecisionSchema),
  asyncHandler(controller.decideMentor),
);
projectRoutes.delete(
  "/:id",
  authenticate,
  validate(projectIdSchema),
  asyncHandler(controller.remove),
);
