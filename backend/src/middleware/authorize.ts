import type { NextFunction, Request, Response } from "express";
import { hasPermission, type Permission } from "../config/permissions.js";
import { ApiError } from "../utils/api-error.js";

export function authorize(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    if (!permissions.every((permission) => hasPermission(req.user!.roles, permission))) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission for this action");
    }
    next();
  };
}
