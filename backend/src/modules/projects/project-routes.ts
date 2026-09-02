import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./project-controller.js";
import {
  createProjectSchema,
  invitationDecisionSchema,
  listProjectsSchema,
  mentorEmailDecisionSchema,
  mentorEmailReviewSchema,
  memberSchema,
  mentorDecisionSchema,
  mentorRequestSchema,
  projectIdSchema,
  projectMemberIdSchema,
  updateProjectSchema,
} from "./project-schema.js";

export const projectRoutes = Router();

projectRoutes.post(
  "/mentor-requests/:requestId/email-review",
  validate(mentorEmailReviewSchema),
  asyncHandler(controller.getMentorEmailReview),
);
projectRoutes.post(
  "/mentor-requests/:requestId/email-decision",
  validate(mentorEmailDecisionSchema),
  asyncHandler(controller.decideMentorEmailRequest),
);
projectRoutes.get("/", authenticate, validate(listProjectsSchema), asyncHandler(controller.list));
projectRoutes.get("/:id", authenticate, validate(projectIdSchema), asyncHandler(controller.get));
projectRoutes.post(
  "/",
  authenticate,
  authorize("project.create"),
  validate(createProjectSchema),
  asyncHandler(controller.create),
);
projectRoutes.post(
  "/:id/invitations/respond",
  authenticate,
  validate(invitationDecisionSchema),
  asyncHandler(controller.respondToInvitation),
);
projectRoutes.delete(
  "/:id/members/:memberId",
  authenticate,
  validate(projectMemberIdSchema),
  asyncHandler(controller.removeMember),
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
// Archiving retires a project but keeps it readable; deleting hides it. Both
// release the seats, machines and material queue the project was holding.
projectRoutes.post(
  "/:id/archive",
  authenticate,
  validate(projectIdSchema),
  asyncHandler(controller.archive),
);
projectRoutes.delete(
  "/:id",
  authenticate,
  validate(projectIdSchema),
  asyncHandler(controller.remove),
);
