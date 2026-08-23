import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { redis } from "../config/redis.js";
import { ApiError } from "../utils/api-error.js";

type RateLimitOptions = {
  windowSeconds: number;
  max: number;
  prefix: string;
  subject?: (req: Request) => string | undefined;
};

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    void applyRateLimit(options, req, res).then(() => next(), next);
  };
}

async function applyRateLimit(options: RateLimitOptions, req: Request, res: Response) {
  const subject = options.subject?.(req) ?? req.user?.id ?? bearerSubject(req) ?? req.ip;
  const key = `rl:${options.prefix}:${subject}`;
  const now = Date.now();
  const windowStart = now - options.windowSeconds * 1000;
  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);
  if (count >= options.max) {
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const retry = oldest[1]
      ? Math.ceil((Number(oldest[1]) + options.windowSeconds * 1000 - now) / 1000)
      : 60;
    res.setHeader("Retry-After", String(Math.max(retry, 1)));
    throw new ApiError(429, "RATE_LIMITED", "Too many requests");
  }
  await redis.zadd(key, now, `${now}:${Math.random()}`);
  await redis.expire(key, options.windowSeconds);
}

export function privateRateLimitSubject(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function bearerSubject(req: Request) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(authorization.slice(7).split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length <= 128
      ? `bearer:${payload.sub}`
      : undefined;
  } catch {
    return undefined;
  }
}
