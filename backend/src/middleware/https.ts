import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env.js";

export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (!isProduction || req.secure || req.header("x-forwarded-proto") === "https") return next();
  return res.redirect(308, `https://${req.header("host")}${req.originalUrl}`);
}
