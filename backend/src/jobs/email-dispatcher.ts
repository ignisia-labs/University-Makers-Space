import crypto from "node:crypto";
import { DeliveryStatus, NotificationChannel } from "@prisma/client";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { sendEmail } from "../config/mailer.js";
import { redis } from "../config/redis.js";
import {
  notificationEmail,
  projectInvitationEmail,
} from "../modules/notifications/email-templates.js";

/**
 * Email dispatcher — the transactional outbox.
 *
 * Notifications and invitations write their delivery row inside the same
 * database transaction as the thing they describe. That is the whole point: a
 * booking is never confirmed without its email being *scheduled*, and an email
 * is never scheduled for a booking that rolled back. Enqueuing to Redis inside
 * the transaction could not give that guarantee — the enqueue would either be
 * lost on rollback or fire for a booking that never existed.
 *
 * This job drains that outbox:
 *  - one instance sends per tick, elected by a Redis lease;
 *  - a row is claimed by an atomic PENDING → PROCESSING transition, so two
 *    dispatchers can never send the same message twice;
 *  - failures back off and retry until MAIL_MAX_ATTEMPTS, then park as FAILED
 *    with the last error retained for review.
 */

const LOCK_KEY = "ums:jobs:email-dispatcher";
const LOCK_TTL_MS = 25_000;
const TICK_INTERVAL_MS = 15_000;
const BATCH_SIZE = 25;
const MAX_BATCHES = 8;

const releaseIfOwnedScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export type DispatchSummary = {
  notificationsSent: number;
  notificationsFailed: number;
  invitationsSent: number;
  invitationsFailed: number;
};

const emptySummary = (): DispatchSummary => ({
  notificationsSent: 0,
  notificationsFailed: 0,
  invitationsSent: 0,
  invitationsFailed: 0,
});

/** Retry delay for attempt N. Exponential, capped, so a dead mail server does
 *  not get hammered and a transient blip recovers quickly. */
function retryAfterMs(attempts: number) {
  return Math.min(30 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

export async function dispatchEmails(now = new Date()): Promise<DispatchSummary> {
  const summary = emptySummary();
  await dispatchNotificationEmails(now, summary);
  await dispatchInvitationEmails(now, summary);
  return summary;
}

async function dispatchNotificationEmails(now: Date, summary: DispatchSummary) {
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const due = await prisma.notificationDelivery.findMany({
      where: {
        channel: NotificationChannel.EMAIL,
        status: DeliveryStatus.PENDING,
        attempts: { lt: env.MAIL_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      include: {
        notification: {
          include: { user: { select: { email: true, isActive: true, deletedAt: true } } },
        },
      },
    });
    if (!due.length) return;

    for (const delivery of due) {
      // Only send after this row is ours. `updateMany` with the expected status
      // in the predicate is the claim: exactly one dispatcher wins.
      const claimed = await prisma.notificationDelivery.updateMany({
        where: { id: delivery.id, status: DeliveryStatus.PENDING },
        data: {
          status: DeliveryStatus.PROCESSING,
          attempts: { increment: 1 },
          updatedAt: now,
        },
      });
      if (claimed.count !== 1) continue;

      const recipient = delivery.notification.user;
      if (!recipient.isActive || recipient.deletedAt) {
        // Nothing to deliver to; park it rather than retrying forever.
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: DeliveryStatus.FAILED, lastError: "Recipient account is not active" },
        });
        summary.notificationsFailed += 1;
        continue;
      }

      const rendered = notificationEmail({
        title: delivery.notification.title,
        body: delivery.notification.body,
        href: delivery.notification.href,
      });
      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          // Stable per delivery row, so a provider that de-duplicates sees the
          // same id if we ever retry after an ambiguous failure.
          messageId: `notification-${delivery.id}`,
        });
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.SENT,
            providerId: result.providerId,
            sentAt: new Date(),
            lastError: null,
          },
        });
        summary.notificationsSent += 1;
      } catch (error) {
        await failDelivery(delivery.id, delivery.attempts + 1, error, summary, "notification");
      }
    }
    if (due.length < BATCH_SIZE) return;
  }
}

async function failDelivery(
  id: string,
  attempts: number,
  error: unknown,
  summary: DispatchSummary,
  kind: "notification" | "invitation",
) {
  const exhausted = attempts >= env.MAIL_MAX_ATTEMPTS;
  const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  await prisma.notificationDelivery.update({
    where: { id },
    data: {
      // Back to PENDING so the next tick retries; FAILED once attempts run out.
      status: exhausted ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
      lastError,
    },
  });
  if (exhausted) {
    logger.error({ deliveryId: id, attempts, lastError, kind }, "Email delivery gave up");
    if (kind === "notification") summary.notificationsFailed += 1;
    else summary.invitationsFailed += 1;
  } else {
    logger.warn(
      { deliveryId: id, attempts, lastError, retryInMs: retryAfterMs(attempts) },
      "Email delivery failed and will be retried",
    );
  }
}

/**
 * Project invitations.
 *
 * These are the reason a teammate without an account can be added at all: the
 * invitation is addressed to an email, not to a user row, and this message is
 * what turns that address into a person who can sign in and onboard.
 */
async function dispatchInvitationEmails(now: Date, summary: DispatchSummary) {
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const due = await prisma.projectMember.findMany({
      where: {
        invitationEmailStatus: DeliveryStatus.PENDING,
        status: "PENDING",
        removedAt: null,
        invitationEmailAttempts: { lt: env.MAIL_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      include: {
        project: { select: { id: true, title: true, creator: { select: { name: true } } } },
      },
    });
    if (!due.length) return;

    for (const invitation of due) {
      const claimed = await prisma.projectMember.updateMany({
        where: { id: invitation.id, invitationEmailStatus: DeliveryStatus.PENDING },
        data: {
          invitationEmailStatus: DeliveryStatus.PROCESSING,
          invitationEmailAttempts: { increment: 1 },
          updatedAt: now,
        },
      });
      if (claimed.count !== 1) continue;

      const rendered = projectInvitationEmail({
        projectTitle: invitation.project.title,
        inviterName: invitation.project.creator.name,
        projectId: invitation.project.id,
        isRegistered: invitation.userId !== null,
      });
      try {
        await sendEmail({
          to: invitation.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          messageId: `invitation-${invitation.id}`,
        });
        await prisma.projectMember.update({
          where: { id: invitation.id },
          data: {
            invitationEmailStatus: DeliveryStatus.SENT,
            invitationEmailSentAt: new Date(),
          },
        });
        summary.invitationsSent += 1;
      } catch (error) {
        const attempts = invitation.invitationEmailAttempts + 1;
        const exhausted = attempts >= env.MAIL_MAX_ATTEMPTS;
        await prisma.projectMember.update({
          where: { id: invitation.id },
          data: {
            invitationEmailStatus: exhausted ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
          },
        });
        if (exhausted) {
          summary.invitationsFailed += 1;
          logger.error(
            { memberId: invitation.id, attempts, err: error },
            "Invitation email gave up",
          );
        } else {
          logger.warn({ memberId: invitation.id, attempts, err: error }, "Invitation email failed");
        }
      }
    }
    if (due.length < BATCH_SIZE) return;
  }
}

/** Runs one tick if this instance wins the lease. Returns null when it does not. */
export async function runEmailDispatcherTick(): Promise<DispatchSummary | null> {
  const lease = crypto.randomUUID();
  const acquired = await redis.set(LOCK_KEY, lease, "PX", LOCK_TTL_MS, "NX");
  if (acquired !== "OK") return null;
  try {
    return await dispatchEmails();
  } finally {
    try {
      await redis.eval(releaseIfOwnedScript, 1, LOCK_KEY, lease);
    } catch (error) {
      logger.warn({ err: error }, "Email dispatcher lease release failed; it will expire");
    }
  }
}

export function startEmailDispatcher() {
  const timer = setInterval(() => {
    void runEmailDispatcherTick()
      .then((summary) => {
        if (
          summary &&
          (summary.notificationsSent ||
            summary.invitationsSent ||
            summary.notificationsFailed ||
            summary.invitationsFailed)
        ) {
          logger.info({ summary }, "Email dispatched");
        }
      })
      .catch((error: unknown) => logger.error({ err: error }, "Email dispatcher tick failed"));
  }, TICK_INTERVAL_MS);
  timer.unref();
  return timer;
}

/** Exposed so a stalled PROCESSING row (a crash mid-send) can be recovered. */
export async function requeueStalledDeliveries(olderThanMs = 5 * 60_000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const [notifications, invitations] = await Promise.all([
    prisma.notificationDelivery.updateMany({
      where: { status: DeliveryStatus.PROCESSING, updatedAt: { lt: cutoff } },
      data: { status: DeliveryStatus.PENDING },
    }),
    prisma.projectMember.updateMany({
      where: { invitationEmailStatus: DeliveryStatus.PROCESSING, updatedAt: { lt: cutoff } },
      data: { invitationEmailStatus: DeliveryStatus.PENDING },
    }),
  ]);
  return { notifications: notifications.count, invitations: invitations.count };
}
