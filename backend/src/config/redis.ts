import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * The shared Redis connection.
 *
 * Managed Redis (Upstash, Render, Redis Cloud) is reached over TLS with a
 * `rediss://` URL. ioredis enables TLS from that scheme on its own, so nothing
 * here needs to branch — but hosted instances do drop idle connections, and
 * without `retryStrategy` a dropped socket ends the process's ability to take
 * a lease or drain the mail outbox until it is restarted.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: false,
  // Back off up to ~5s. Rate limiting and the job leases degrade gracefully
  // while it reconnects; giving up entirely would not.
  retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
  reconnectOnError: (error) => {
    // A managed failover surfaces as READONLY against the old primary.
    if (error.message.includes("READONLY")) return true;
    return false;
  },
});

redis.on("error", (error) => {
  logger.warn({ err: error }, "Redis connection error");
});
