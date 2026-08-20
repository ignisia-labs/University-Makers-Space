import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.requestId = req.header("x-request-id") ?? crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
}
