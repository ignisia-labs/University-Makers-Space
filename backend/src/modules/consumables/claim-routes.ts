import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./claim-controller.js";
import {
  allowanceSchema,
  claimIdSchema,
  createClaimSchema,
  decideClaimSchema,
  listClaimsSchema,
} from "./claim-schema.js";

export const consumableClaimRoutes = Router();
const claimLimiter = rateLimit({ prefix: "consumable-claim", windowSeconds: 60, max: 30 });

consumableClaimRoutes.get(
  "/allowance/:projectId",
  authenticate,
  authorize("consumable.claim"),
  validate(allowanceSchema),
  asyncHandler(controller.allowance),
);
consumableClaimRoutes.get(
  "/",
  authenticate,
  validate(listClaimsSchema),
  asyncHandler(controller.list),
);
consumableClaimRoutes.post(
  "/",
  authenticate,
  authorize("consumable.claim"),
  claimLimiter,
  validate(createClaimSchema),
  asyncHandler(controller.create),
);
// Withdrawal is ownership-checked in the service, not by permission: a student
// withdrawing their own claim needs no MakerSpace authority.
consumableClaimRoutes.post(
  "/:id/cancel",
  authenticate,
  claimLimiter,
  validate(claimIdSchema),
  asyncHandler(controller.cancel),
);
consumableClaimRoutes.post(
  "/:id/decision",
  authenticate,
  authorize("consumable.manage"),
  claimLimiter,
  validate(decideClaimSchema),
  asyncHandler(controller.decide),
);
