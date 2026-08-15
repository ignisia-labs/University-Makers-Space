import { z } from "zod";
import { idParam, listQuery } from "../shared/schemas.js";

const status = z.enum(["draft", "team_acceptance_pending", "mentor_approval_pending", "verified", "rejected", "archived"]);

const body = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
}).strict();

export const listProjectsSchema = z.object({ query: listQuery.extend({ creatorId: z.string().uuid().optional() }).strict() });
export const createProjectSchema = z.object({ body });
export const updateProjectSchema = z.object({ params: idParam, body: body.partial().extend({ status: status.optional() }).strict() });
export const projectIdSchema = z.object({ params: idParam });
export const memberSchema = z.object({ params: idParam, body: z.object({ userId: z.string().uuid(), role: z.string().trim().min(2).max(40).default("member") }).strict() });
