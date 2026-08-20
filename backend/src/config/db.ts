import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

export const prisma = new PrismaClient({
  log: [
    { level: "error", emit: "event" },
    { level: "warn", emit: "event" },
  ],
});

prisma.$on("error", (event) => logger.error({ target: event.target }, event.message));
prisma.$on("warn", (event) => logger.warn({ target: event.target }, event.message));
