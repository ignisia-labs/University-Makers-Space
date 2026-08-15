import { z } from "zod";
import { idParam, listQuery } from "../shared/schemas.js";

const role = z.enum(["student", "admin", "moderator", "staff"]);

export const listUsersSchema = z.object({
  query: listQuery.extend({ role: role.optional(), isActive: z.coerce.boolean().optional() }).strict(),
});

export const updateUserSchema = z.object({
  params: idParam,
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    roles: z.array(role).min(1).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    isActive: z.boolean().optional(),
  }).strict(),
});

export const userIdSchema = z.object({ params: idParam });
