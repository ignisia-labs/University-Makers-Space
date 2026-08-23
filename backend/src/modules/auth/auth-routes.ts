import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { privateRateLimitSubject, rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./auth-controller.js";
import { googleSignInSchema, onboardingSchema } from "./auth-schema.js";

export const authRoutes = Router();
const googleSignInLimiter = rateLimit({
  prefix: "auth-google",
  windowSeconds: 900,
  max: 20,
  subject: (req) => privateRateLimitSubject(req.body?.credential),
});
const refreshLimiter = rateLimit({
  prefix: "auth-refresh",
  windowSeconds: 900,
  max: 120,
  subject: (req) => privateRateLimitSubject(req.cookies?.ums_refresh_token),
});

authRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

authRoutes.get("/google/config", controller.googleConfig);
authRoutes.get("/student-profile/config", authenticate, controller.studentProfileConfig);
authRoutes.get("/google/csrf", controller.loginCsrf);
authRoutes.post(
  "/google",
  googleSignInLimiter,
  validate(googleSignInSchema),
  asyncHandler(controller.googleSignIn),
);
authRoutes.post("/refresh", refreshLimiter, asyncHandler(controller.refresh));
authRoutes.post("/logout", authenticate, asyncHandler(controller.logout));
authRoutes.get("/me", authenticate, asyncHandler(controller.me));
authRoutes.post(
  "/onboarding",
  authenticate,
  authorize("profile.complete"),
  validate(onboardingSchema),
  asyncHandler(controller.onboarding),
);
