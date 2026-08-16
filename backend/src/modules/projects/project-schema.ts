import { z } from "zod";
import { MentorRequestStatus, ProjectStatus } from "@prisma/client";
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
    idempotencyKey: z.string().uuid(),
    labId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(2000),
    teamMemberEmails: z.array(institutionalEmail).max(20).default([]),
    mentorId: z.string().uuid(),
    equipmentIds: z.array(z.string().uuid()).max(100).default([]),
    consumableIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict();

export const listProjectsSchema = z.object({
  query: listQuery
    .extend({
      creatorId: z.string().uuid().optional(),
      labId: z.string().uuid().optional(),
      status: z.nativeEnum(ProjectStatus).optional(),
      mentorRequestStatus: z.nativeEnum(MentorRequestStatus).optional(),
    })
    .strict(),
});
export const createProjectSchema = z.object({ body });
export const updateProjectSchema = z.object({
  params: idParam,
  body: z
    .object({
      title: z.string().trim().min(2).max(160).optional(),
      description: z.string().trim().min(1).max(2000).optional(),
      equipmentIds: z.array(z.string().uuid()).max(100).optional(),
      consumableIds: z.array(z.string().uuid()).max(100).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one change is required"),
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

export const invitationDecisionSchema = z.object({
  params: idParam,
  body: z.object({ decision: z.enum(["ACCEPTED", "DECLINED"]) }).strict(),
});

export const projectMemberIdSchema = z.object({
  params: z.object({ id: z.string().uuid(), memberId: z.string().uuid() }).strict(),
});
