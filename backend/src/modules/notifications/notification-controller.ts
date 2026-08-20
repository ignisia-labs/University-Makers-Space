import type { Request, Response } from "express";
import { created, ok } from "../../utils/api-response.js";
import * as service from "./notification-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query, req.user!.id);
  return ok(res, "Notification list", result.data, result.meta);
}

export async function create(req: Request, res: Response) {
  return created(res, "Notification created", await service.create(req.body));
}

export async function markRead(req: Request, res: Response) {
  return ok(
    res,
    "Notification updated",
    await service.markRead(req.params.id!, req.user!.id, req.body.isRead),
  );
}
