import { env } from "../../config/env.js";
import { primaryFrontendUrl } from "../../config/env.js";

/**
 * Email bodies.
 *
 * Every value interpolated here originates from user input (project titles,
 * names, reasons), so all of it is HTML-escaped. The plain-text alternative is
 * always sent alongside the HTML — some institutional mail clients strip HTML
 * entirely, and an invitation that arrives blank is an invitation that is lost.
 */

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Only same-origin application paths become links. A `href` that arrived as
 * data must never be able to point the recipient at another host.
 */
export function safeAppUrl(href: string | null | undefined) {
  if (!href) return primaryFrontendUrl;
  if (!href.startsWith("/") || href.startsWith("//")) return primaryFrontendUrl;
  return `${primaryFrontendUrl.replace(/\/$/, "")}${href}`;
}

type Layout = {
  heading: string;
  intro: string;
  body?: string | undefined;
  ctaLabel?: string | undefined;
  ctaHref?: string | undefined;
  footer?: string | undefined;
};

export function renderEmail(layout: Layout) {
  const heading = escapeHtml(layout.heading);
  const intro = escapeHtml(layout.intro);
  const body = layout.body ? escapeHtml(layout.body) : "";
  const footer = escapeHtml(
    layout.footer ?? "You are receiving this because you have an MIT-WPU MakerSpace account.",
  );
  const cta =
    layout.ctaLabel && layout.ctaHref
      ? `<p style="margin:28px 0 0"><a href="${escapeHtml(layout.ctaHref)}" style="background:#2a2a8f;color:#ffffff;border-radius:999px;display:inline-block;font:600 14px system-ui,-apple-system,sans-serif;padding:12px 26px;text-decoration:none">${escapeHtml(layout.ctaLabel)}</a></p>`
      : "";

  const html = `<!doctype html>
<html lang="en"><body style="background:#f5f5fa;margin:0;padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px">
    <tr><td style="padding:32px">
      <p style="margin:0;font:600 11px system-ui,-apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2a2a8f">MIT-WPU MakerSpace</p>
      <h1 style="margin:14px 0 0;font:400 24px Georgia,serif;color:#16161d">${heading}</h1>
      <p style="margin:16px 0 0;font:400 15px/1.6 system-ui,-apple-system,sans-serif;color:#3d3d4a">${intro}</p>
      ${body ? `<p style="margin:14px 0 0;font:400 15px/1.6 system-ui,-apple-system,sans-serif;color:#3d3d4a">${body}</p>` : ""}
      ${cta}
      <p style="margin:28px 0 0;font:400 12px/1.6 system-ui,-apple-system,sans-serif;color:#8a8a99">${footer}</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    "MIT-WPU MakerSpace",
    "",
    layout.heading,
    "",
    layout.intro,
    layout.body ? `\n${layout.body}` : "",
    layout.ctaHref ? `\n${layout.ctaLabel ?? "Open"}: ${layout.ctaHref}` : "",
    "",
    layout.footer ?? "You are receiving this because you have an MIT-WPU MakerSpace account.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { html, text };
}

/**
 * The invitation sent to somebody who may not have an account yet.
 *
 * This is the message that lets a teammate join: they sign in with their
 * institutional Google account, complete onboarding, and the invitation is
 * already waiting for them — no administrator has to create the account first.
 */
export function projectInvitationEmail(input: {
  projectTitle: string;
  inviterName: string;
  projectId: string;
  isRegistered: boolean;
}) {
  const href = safeAppUrl(`/invitations/${input.projectId}`);
  const { html, text } = renderEmail({
    heading: `Join ${input.projectTitle}`,
    intro: `${input.inviterName} invited you to join their MIT-WPU MakerSpace project.`,
    body: input.isRegistered
      ? "Open the invitation to accept or decline. Once the whole team accepts, the project goes to your Faculty Mentor for approval."
      : "Sign in with your MIT-WPU Google account to get started. You will be asked to complete a short student profile, and this invitation will be waiting for you straight after.",
    ctaLabel: input.isRegistered ? "View the invitation" : "Sign in and join",
    ctaHref: href,
    footer: "If you were not expecting this, you can ignore this email.",
  });
  return { subject: `You have been invited to join ${input.projectTitle}`, html, text };
}

/** Generic renderer for anything already stored as an in-app notification. */
export function notificationEmail(input: { title: string; body: string; href: string | null }) {
  const { html, text } = renderEmail({
    heading: input.title,
    intro: input.body,
    ctaLabel: input.href ? "Open the MakerSpace" : undefined,
    ctaHref: input.href ? safeAppUrl(input.href) : undefined,
  });
  return { subject: input.title, html, text };
}
