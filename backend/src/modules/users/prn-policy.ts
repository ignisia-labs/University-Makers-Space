import { z } from "zod";
import { env } from "../../config/env.js";

export const prnPattern = new RegExp(env.PRN_PATTERN);

export function normalizePrn(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export const prnSchema = z
  .string()
  .transform(normalizePrn)
  .refine((value) => prnPattern.test(value), env.PRN_FORMAT_HINT);

export const prnPolicy = {
  pattern: env.PRN_PATTERN,
  hint: env.PRN_FORMAT_HINT,
  maxLength: 24,
};
