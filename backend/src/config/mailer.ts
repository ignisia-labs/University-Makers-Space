import nodemailer, { type Transporter } from "nodemailer";
import { env, isEmailConfigured } from "./env.js";
import { logger } from "./logger.js";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Stable per-message id used for provider-side de-duplication. */
  messageId: string;
};

export type SendResult = { providerId: string; transport: "smtp" | "console" };

let transporter: Transporter | null = null;

function smtpTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
      // Keep connections warm across a burst rather than reconnecting per
      // message; the dispatcher sends in batches.
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      // Without these, a stalled TCP handshake or an SMTP server that accepts
      // a connection and never responds hangs the sender indefinitely — the
      // dispatcher's retry logic never gets a chance to run because the call
      // that's supposed to fail just never returns.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

/**
 * Sends one message.
 *
 * Without SMTP_HOST this logs instead of sending. That is deliberate: local and
 * CI runs must never deliver mail to a real student, and a developer should be
 * able to run the whole invitation flow with no mail server at all. The
 * transport used is recorded on the delivery row, so a console send is never
 * mistaken for a real one.
 */
export async function sendEmail(email: OutboundEmail): Promise<SendResult> {
  if (!isEmailConfigured) {
    logger.info(
      { to: email.to, subject: email.subject, messageId: email.messageId },
      "Email not sent — SMTP is not configured, logging instead",
    );
    return { providerId: `console:${email.messageId}`, transport: "console" };
  }

  const info = await smtpTransport().sendMail({
    from: env.MAIL_FROM,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    messageId: `<${email.messageId}@mitwpu.edu.in>`,
  });
  return { providerId: info.messageId ?? email.messageId, transport: "smtp" };
}

export async function closeMailer() {
  transporter?.close();
  transporter = null;
}
