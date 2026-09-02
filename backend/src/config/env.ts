import "dotenv/config";
import { z } from "zod";

/**
 * A `.env` file routinely carries `KEY=` for "not set". Zod would treat that
 * empty string as a present value and reject it, so blank is normalised to
 * absent before validation — otherwise the app refuses to boot over a variable
 * that is deliberately unconfigured.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(20),
  GOOGLE_HOSTED_DOMAIN: z.string().trim().toLowerCase().default("mitwpu.edu.in"),
  PRN_PATTERN: z
    .string()
    .default("^[A-Za-z0-9][A-Za-z0-9/-]{5,23}$")
    .refine((value) => {
      try {
        new RegExp(value);
        return true;
      } catch {
        return false;
      }
    }, "PRN_PATTERN must be a valid regular expression"),
  PRN_FORMAT_HINT: z.string().min(1).max(160).default("Enter the PRN issued by MIT-WPU."),
  REDIS_URL: z.string().url(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  /**
   * Where the app is served from. Comma-separated so a deployment can allow its
   * production URL alongside preview builds; the first entry is the canonical
   * one used when the server needs to link back to the app.
   */
  FRONTEND_URL: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    )
    .refine((entries) => entries.length > 0, "FRONTEND_URL must list at least one origin")
    .refine(
      (entries) => entries.every((entry) => /^https?:\/\//.test(entry)),
      "Every FRONTEND_URL entry must be an absolute http(s) origin",
    ),
  /**
   * Whether the browser will send the refresh cookie cross-site.
   *
   * When the app and the API share an origin — a dev proxy, or a single domain
   * behind one router — "lax" is correct and safest. When they are on separate
   * hosts, as with a static host and a separate API service, the browser drops
   * a lax cookie entirely and sign-in appears to succeed and then immediately
   * forget itself. That case needs SameSite=None, which browsers only accept on
   * a secure connection.
   */
  CROSS_SITE_COOKIES: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  // ─── Email (Phase 7) ───────────────────────────────────────────────────────
  // All optional. Without SMTP_HOST the app uses a console transport: messages
  // are logged rather than sent, so local development needs no mail server and
  // never accidentally emails a real student.
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  MAIL_FROM: z.string().min(3).default("MIT-WPU MakerSpace <no-reply@mitwpu.edu.in>"),
  /// Maximum delivery attempts before a message is parked as FAILED.
  MAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";

/** The canonical app origin — the one used when building links back to the app. */
export const primaryFrontendUrl = env.FRONTEND_URL[0]!;

if (env.CROSS_SITE_COOKIES && !isProduction) {
  // Browsers refuse SameSite=None without Secure, and Secure needs HTTPS, so
  // this combination silently breaks sign-in on a plain-HTTP dev server.
  console.warn(
    "[env] CROSS_SITE_COOKIES is on outside production; the refresh cookie will be rejected over plain HTTP.",
  );
}
export const isEmailConfigured = Boolean(env.SMTP_HOST);
