import { z } from "zod";
import { idParam, listQuery } from "../shared/schemas.js";

export const listNotificationsSchema = z.object({
  query: listQuery.extend({ isRead: z.coerce.boolean().optional(), type: z.string().trim().max(60).optional() }).strict(),
});

export const createNotificationSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    type: z.string().trim().min(2).max(60),
    message: z.string().trim().min(1).max(500),
  }).strict(),
});

export const notificationIdSchema = z.object({ params: idParam });
export const readSchema = z.object({ params: idParam, body: z.object({ isRead: z.boolean() }).strict() });
