import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { isProduction } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/api-error.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const apiError = normalizeError(err);
  logger.error(
    { err, requestId: req.requestId, userId: req.user?.id, path: req.path },
    apiError.message,
  );
  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.isOperational || !isProduction ? apiError.message : "Internal server error",
    error: {
      code: apiError.code,
      details: apiError.details,
      ...(!isProduction && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
}

function normalizeError(err: unknown) {
  if (err instanceof ApiError) return err;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return new ApiError(409, "CONFLICT", "Resource already exists");
    }
    if (err.code === "P2003") {
      return new ApiError(400, "INVALID_REFERENCE", "A referenced resource does not exist");
    }
    if (err.code === "P2025") {
      return new ApiError(404, "NOT_FOUND", "Resource not found");
    }
    if (err.code === "P2034") {
      return new ApiError(
        409,
        "TRANSACTION_CONFLICT",
        "The resource changed during this request; retry with current availability",
      );
    }
  }
  return new ApiError(500, "INTERNAL_ERROR", "Internal server error", [], false);
}
