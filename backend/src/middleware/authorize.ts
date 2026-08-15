import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    if (!roles.some((role) => req.user?.roles.includes(role))) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission for this action");
    }
    next();
  };
}
