/**
 * Serverless entry point.
 *
 * Vercel (and any platform that expects a request handler rather than a
 * listening process) imports this. It is the same Express application the
 * long-running server builds — only the way it is invoked differs.
 *
 * `src/server.ts` remains the entry point for a normal Node host such as
 * Render, where `npm run start` binds a port.
 *
 * Two things this file cannot do for you:
 *
 *  - **Scheduling.** Nothing runs between requests here, so a platform cron must
 *    call `POST /api/v1/jobs/run` with the `JOBS_TOKEN` header. Without it,
 *    no-show slots are never released and queued email is never sent.
 *  - **Connection pooling.** Every cold start opens a database connection. Use
 *    the provider's pooled endpoint and `connection_limit=1`.
 */
import { createApp } from "../src/app.js";

export default createApp();
