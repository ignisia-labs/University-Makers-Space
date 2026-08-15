import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis.js";
import { ApiError } from "../utils/api-error.js";

type RateLimitOptions = { windowSeconds: number; max: number; prefix: string };

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    void applyRateLimit(options, req, res).then(() => next(), next);
  };
}

async function applyRateLimit(options: RateLimitOptions, req: Request, res: Response) {
  const subject = req.user?.id ?? req.ip;
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
