import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { ApiError } from "../utils/api-error.js";

export type AccessPayload = { sub: string; tokenVersion: number; type: "access" };

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessPayload;
    if (payload.type !== "access") throw new Error("Wrong token type");
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, roles: true, tokenVersion: true, isActive: true },
    });
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      throw new ApiError(401, "UNAUTHENTICATED", "Session is no longer valid");
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token");
  }
}
