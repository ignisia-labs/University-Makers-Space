import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { ApiError } from "../../utils/api-error.js";
import { ok } from "../../utils/api-response.js";
import { runReconcilerTick } from "../../jobs/attendance-reconciler.js";
import { requeueStalledDeliveries, runEmailDispatcherTick } from "../../jobs/email-dispatcher.js";

/**
 * Scheduled maintenance, triggered over HTTP.
 *
 * The API used to run these on in-process timers, which requires a process that
 * stays alive between requests. On a serverless platform there is no such
 * process, so the schedule moves outside: a platform cron calls this endpoint
 * and the same work runs.
 *
 * The work itself is unchanged, and still takes a Redis lease — two cron
 * invocations that overlap, or a manual call during a scheduled one, must not
 * both release the same no-show booking.
 */
function assertAuthorised(req: Request) {
  const expected = env.JOBS_TOKEN;
  if (!expected) {
    // Unset means "not deployed for external scheduling". Refusing is the safe
    // default: an unauthenticated endpoint that mutates bookings is worse than
    // one that is switched off.
    throw new ApiError(404, "NOT_FOUND", "Not found");
  }
  // Two shapes, because schedulers differ: Vercel Cron sends
  // `Authorization: Bearer <CRON_SECRET>` and cannot add custom headers, while
  // Render Cron, GitHub Actions and cron-job.org can send either.
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const presented = req.header("x-jobs-token") ?? bearer;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // Compare in constant time, and only when the lengths already match —
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid job token");
  }
}

export async function run(req: Request, res: Response) {
  assertAuthorised(req);
  const startedAt = Date.now();

  // A previous run that died mid-send leaves rows stuck in PROCESSING. This used
  // to be recovered at boot; without a boot to hook into, it runs first here.
  const recovered = await requeueStalledDeliveries();
  const attendance = await runReconcilerTick();
  const email = await runEmailDispatcherTick();

  const summary = {
    recovered,
    attendance,
    email,
    elapsedMs: Date.now() - startedAt,
  };
  logger.info({ summary }, "Scheduled maintenance ran");
  return ok(res, "Maintenance complete", summary);
}
