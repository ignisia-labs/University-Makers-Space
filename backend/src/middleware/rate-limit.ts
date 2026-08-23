import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";
import { ApiError } from "../utils/api-error.js";

type RateLimitOptions = {
  windowSeconds: number;
  max: number;
  prefix: string;
  subject?: (req: Request) => string | undefined;
};

const atomicSlidingWindowScript = `
local key = KEYS[1]
local window_start = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local maximum = tonumber(ARGV[3])
local ttl_seconds = tonumber(ARGV[4])
local member = ARGV[5]

redis.call("ZREMRANGEBYSCORE", key, 0, window_start)
local count = redis.call("ZCARD", key)
if count >= maximum then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  redis.call("EXPIRE", key, ttl_seconds)
  return {0, oldest[2] or now}
end

redis.call("ZADD", key, now, member)
redis.call("EXPIRE", key, ttl_seconds)
return {1, 0}
`;

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
  const result = (await redis.eval(
    atomicSlidingWindowScript,
    1,
    key,
    windowStart,
    now,
    options.max,
    options.windowSeconds,
    `${now}:${crypto.randomUUID()}`,
  )) as [number, number | string];
  if (Number(result[0]) !== 1) {
    const oldestScore = Number(result[1]);
    const retry = Number.isFinite(oldestScore)
      ? Math.ceil((oldestScore + options.windowSeconds * 1000 - now) / 1000)
      : options.windowSeconds;
    res.setHeader("Retry-After", String(Math.max(retry, 1)));
    throw new ApiError(429, "RATE_LIMITED", "Too many requests");
  }
}

export function privateRateLimitSubject(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function bearerSubject(req: Request) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  try {
    const payload = jwt.verify(authorization.slice(7), env.JWT_SECRET) as {
      sub?: unknown;
      type?: unknown;
    };
    return payload.type === "access" && typeof payload.sub === "string" && payload.sub.length <= 128
      ? `bearer:${payload.sub}`
      : undefined;
  } catch {
    return undefined;
  }
}
