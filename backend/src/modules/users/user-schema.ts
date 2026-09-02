import { UserRole } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { idParam, listQuery } from "../shared/schemas.js";
import { prnSchema } from "./prn-policy.js";

const role = z.nativeEnum(UserRole);
const institutionalEmail = z
  .string()
  .trim()
  .email()
  .toLowerCase()
  .refine((email) => email.endsWith(`@${env.GOOGLE_HOSTED_DOMAIN}`), {
    message: `Email must use @${env.GOOGLE_HOSTED_DOMAIN}`,
  });

export const listUsersSchema = z.object({
  query: listQuery
    .extend({ role: role.optional(), isActive: z.coerce.boolean().optional() })
    .strict(),
});

export const updateUserSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      avatarUrl: z.string().url().nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const updateRolesSchema = z.object({
  params: idParam,
  body: z.object({ roles: z.array(role).min(1) }).strict(),
});

export const provisioningSchema = z.object({
  body: z
    .object({
      email: institutionalEmail,
      name: z.string().trim().min(2).max(100).optional(),
      roles: z.array(role).min(1),
      isActive: z.boolean().default(true),
    })
    .strict(),
});

export const updateProvisioningSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: z.string().trim().min(2).max(100).nullable().optional(),
      roles: z.array(role).min(1).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const userIdSchema = z.object({ params: idParam });

export const directorySearchSchema = z.object({
  query: listQuery
    .pick({ page: true, limit: true, search: true })
    .extend({ search: z.string().trim().min(2).max(100) })
    .strict(),
});

/**
 * The faculty-mentor directory is browsable, so `search` is optional here.
 *
 * That is deliberately different from the student search above, which stays
 * search-gated: dumping the full student roster to any signed-in student is a
 * privacy leak, whereas choosing a mentor requires seeing who is on offer. A
 * student cannot pick a name they have never heard of out of a search box.
 */
export const mentorDirectorySchema = z.object({
  query: listQuery.pick({ page: true, limit: true, search: true }).strict(),
});

export const studentDirectorySearchSchema = directorySearchSchema;

export const updateOwnStudentProfileSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(100),
      prn: prnSchema,
      departmentId: z.string().uuid(),
      programmeId: z.string().uuid(),
      academicYear: z.number().int().positive(),
      division: z.string().trim().min(1).max(30).nullable().optional(),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9]{10,15}$/)
        .nullable()
        .optional(),
    })
    .strict(),
});
