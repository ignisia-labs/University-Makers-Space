import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { loginSchema, registerSchema } from "./auth-schema.js";
import * as controller from "./auth-controller.js";

export const authRoutes = Router();
const authLimiter = rateLimit({ prefix: "auth", windowSeconds: 900, max: 10 });

authRoutes.post("/register", authLimiter, validate(registerSchema), asyncHandler(controller.register));
authRoutes.post("/login", authLimiter, validate(loginSchema), asyncHandler(controller.login));
authRoutes.post("/refresh", authLimiter, asyncHandler(controller.refresh));
authRoutes.post("/logout", authenticate, asyncHandler(controller.logout));
authRoutes.get("/me", authenticate, asyncHandler(controller.me));
