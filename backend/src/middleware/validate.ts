import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";
import { ApiError } from "../utils/api-error.js";

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Invalid request data",
        result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }
    req.body = result.data.body ?? {};
    req.params = result.data.params ?? {};
    req.query = result.data.query ?? {};
    next();
  };
}
