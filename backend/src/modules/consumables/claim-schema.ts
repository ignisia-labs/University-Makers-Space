import { z } from "zod";
import { listQuery } from "../shared/schemas.js";

export const createClaimSchema = z.object({
  body: z
    .object({
      projectId: z.string().uuid(),
      consumableId: z.string().uuid(),
      quantity: z.number().int().min(1).max(1000),
      variant: z.string().trim().max(120).nullable().optional(),
      bookingId: z.string().uuid().nullable().optional(),
      note: z.string().trim().max(300).nullable().optional(),
      idempotencyKey: z.string().uuid(),
    })
    .strict(),
});

export const decideClaimSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      decision: z.enum(["ISSUED", "REJECTED"]),
      reason: z.string().trim().max(300).nullable().optional(),
    })
    .strict()
    // A refusal must say why. "Declined" with no reason leaves a student with
    // nothing to act on and the desk with nothing to stand behind.
    .refine((value) => value.decision !== "REJECTED" || Boolean(value.reason?.trim()), {
      message: "A reason is required when declining a claim",
      path: ["reason"],
    }),
});

export const claimIdSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const listClaimsSchema = z.object({
  query: listQuery
    .pick({ page: true, limit: true })
    .extend({
      projectId: z.string().uuid().optional(),
      bookingId: z.string().uuid().optional(),
      status: z.enum(["PENDING", "ISSUED", "REJECTED", "CANCELLED"]).optional(),
    })
    .strict(),
});

export const allowanceSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
});
