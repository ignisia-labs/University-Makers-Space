import { z } from "zod";
import { prnSchema } from "../users/prn-policy.js";

export const googleSignInSchema = z.object({
  body: z
    .object({
      credential: z.string().min(100).max(10_000),
      csrfToken: z.string().min(32).max(256),
    })
    .strict(),
});

export const onboardingSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(100),
      prn: prnSchema,
      departmentId: z.string().uuid(),
      programmeId: z.string().uuid(),
      academicYear: z.number().int().positive(),
      division: z.string().trim().min(1).max(30).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9]{10,15}$/)
        .optional(),
    })
    .strict(),
});
