import type { NextFunction, Request, Response } from "express";

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
}

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  for (const key of Object.keys(value)) {
    const record = value as Record<string, unknown>;
    if (key.startsWith("$") || key.includes(".") || BLOCKED_KEYS.has(key)) {
      delete record[key];
      continue;
    }
    if (typeof record[key] === "string") record[key] = record[key].trim();
    else sanitize(record[key]);
  }
  return value;
}
