import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/db.js";
import { redis } from "./config/redis.js";
import { startAttendanceReconciler } from "./jobs/attendance-reconciler.js";
import { requeueStalledDeliveries, startEmailDispatcher } from "./jobs/email-dispatcher.js";
import { closeMailer } from "./config/mailer.js";

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "UMS backend listening");
});

// Safe to start on every instance: a Redis lease elects one worker per tick.
const reconciler = startAttendanceReconciler();
const emailDispatcher = startEmailDispatcher();

// A crash mid-send leaves rows stuck in PROCESSING. Recover them on boot so a
// restart never silently swallows an invitation.
void requeueStalledDeliveries()
  .then((recovered) => {
    if (recovered.notifications || recovered.invitations) {
      logger.info({ recovered }, "Requeued stalled email deliveries");
    }
  })
  .catch((error: unknown) => logger.error({ err: error }, "Stalled delivery recovery failed"));

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  clearInterval(reconciler);
  clearInterval(emailDispatcher);
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
