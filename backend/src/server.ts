import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/db.js";
import { redis } from "./config/redis.js";
import { closeMailer } from "./config/mailer.js";

/**
 * The long-running entry point.
 *
 * Scheduled maintenance — releasing no-shows, closing overstayed visits,
 * draining the mail outbox — no longer runs on in-process timers. It is
 * triggered by a scheduler calling `POST /api/v1/jobs/run` with `JOBS_TOKEN`,
 * so the same build runs unchanged on a serverless platform where no process
 * survives between requests.
 *
 * That work still has to happen. Without a scheduler pointed at that endpoint,
 * no-show slots are never released and no invitation email is ever sent.
 */
const server = createApp().listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, scheduledMaintenance: env.JOBS_TOKEN ? "external" : "not configured" },
    "UMS backend listening",
  );
  if (!env.JOBS_TOKEN) {
    logger.warn(
      "JOBS_TOKEN is unset, so POST /api/v1/jobs/run is disabled. No-shows will not be released and queued email will not be sent until a scheduler is configured.",
    );
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await closeMailer();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ reason }, "Unhandled rejection"));
process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  process.exit(1);
});
