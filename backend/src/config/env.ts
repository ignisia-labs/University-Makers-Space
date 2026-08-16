import "dotenv/config";
import { z } from "zod";

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
  FRONTEND_URL: z.string().url(),
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
