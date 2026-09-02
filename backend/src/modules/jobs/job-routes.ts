import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./job-controller.js";

export const jobRoutes = Router();

// Deliberately outside the authenticated surface: the caller is a scheduler,
// not a person, and it presents a shared token rather than a session.
jobRoutes.post("/run", asyncHandler(controller.run));
