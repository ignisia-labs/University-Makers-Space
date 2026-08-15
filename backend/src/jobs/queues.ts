import { Queue } from "bullmq";
import { env } from "../config/env.js";

export const notificationQueue = new Queue("notifications", {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
});
