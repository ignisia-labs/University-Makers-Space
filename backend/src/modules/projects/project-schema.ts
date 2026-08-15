import { z } from "zod";
import { env } from "../../config/env.js";
import { idParam, listQuery } from "../shared/schemas.js";

const institutionalEmail = z
  .string()
  .trim()
  .email()
  .toLowerCase()
  .refine((email) => email.endsWith(`@${env.GOOGLE_HOSTED_DOMAIN}`), {
    message: `Email must use @${env.GOOGLE_HOSTED_DOMAIN}`,
  });

const body = z
  .object({
    labId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(2000),
    domain: z.string().trim().min(2).max(100).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  })
  .strict();

export const listProjectsSchema = z.object({
  query: listQuery
    .extend({
      creatorId: z.string().uuid().optional(),
      labId: z.string().uuid().optional(),
    })
    .strict(),
});
export const createProjectSchema = z.object({ body });
export const updateProjectSchema = z.object({
  params: idParam,
  body: body.omit({ labId: true }).partial(),
});
export const projectIdSchema = z.object({ params: idParam });
export const memberSchema = z.object({
  params: idParam,
  body: z.object({ email: institutionalEmail }).strict(),
});
export const mentorRequestSchema = z.object({
  params: idParam,
  body: z.object({ facultyId: z.string().uuid() }).strict(),
});
export const mentorDecisionSchema = z.object({
  params: idParam,
  body: z
    .object({
      decision: z.enum(["APPROVED", "REJECTED"]),
      reason: z.string().trim().min(3).max(1000).optional(),
    })
    .strict()
    .refine((value) => value.decision !== "REJECTED" || Boolean(value.reason), {
      message: "A reason is required when rejecting a project",
      path: ["reason"],
    }),
});
