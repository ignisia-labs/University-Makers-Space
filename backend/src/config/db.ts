import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

/**
 * The database client.
 *
 * Cached on `globalThis` because a serverless platform reuses the module
 * instance between invocations but re-evaluates modules on every cold start and
 * on every hot reload. Without the cache each one opens a fresh pool, and a
 * managed database's connection allowance is exhausted long before its CPU is.
 *
 * On a small plan also set `connection_limit=1` in DATABASE_URL, and point it at
 * the provider's pooled endpoint (PgBouncer, Neon's `-pooler` host) if there is
 * one — a pool per invocation is the classic way to take a database down.
 */
function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  });
  client.$on("error", (event) => logger.error({ target: event.target }, event.message));
  client.$on("warn", (event) => logger.warn({ target: event.target }, event.message));
  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
