import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./project-controller.js";
import { createProjectSchema, listProjectsSchema, memberSchema, projectIdSchema, updateProjectSchema } from "./project-schema.js";

export const projectRoutes = Router();

projectRoutes.get("/", authenticate, validate(listProjectsSchema), asyncHandler(controller.list));
projectRoutes.get("/:id", authenticate, validate(projectIdSchema), asyncHandler(controller.get));
projectRoutes.post("/", authenticate, authorize("student", "admin", "moderator"), validate(createProjectSchema), asyncHandler(controller.create));
projectRoutes.patch("/:id", authenticate, authorize("admin", "moderator"), validate(updateProjectSchema), asyncHandler(controller.update));
projectRoutes.post("/:id/members", authenticate, authorize("admin", "moderator"), validate(memberSchema), asyncHandler(controller.addMember));
projectRoutes.delete("/:id", authenticate, authorize("admin", "moderator"), validate(projectIdSchema), asyncHandler(controller.remove));
