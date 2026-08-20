import crypto from "node:crypto";
import { redis } from "../config/redis.js";

export function cacheKey(prefix: string, query: unknown) {
  const hash = crypto.createHash("sha256").update(JSON.stringify(query)).digest("hex");
  return `${prefix}:${hash}`;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? (JSON.parse(cached) as T) : null;
}

export async function setJson(key: string, value: unknown, ttlSeconds: number) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function invalidate(pattern: string) {
  const stream = redis.scanStream({ match: pattern, count: 100 });
  for await (const keys of stream) {
    if (Array.isArray(keys) && keys.length > 0) await redis.del(...keys);
  }
}
