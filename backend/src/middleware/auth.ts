import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { ApiError } from "../utils/api-error.js";

export type AccessPayload = { sub: string; sid: string; type: "access" };

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  void authenticateRequest(req).then(() => next(), next);
}

async function authenticateRequest(req: Request) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessPayload;
    if (payload.type !== "access") throw new Error("Wrong token type");
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
            profileComplete: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!session || !session.user.isActive || session.user.deletedAt) {
      throw new ApiError(401, "UNAUTHENTICATED", "Session is no longer valid");
    }
    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      roles: session.user.roles,
      profileComplete: session.user.profileComplete,
      isActive: session.user.isActive,
      sessionId: session.id,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token");
  }
}
