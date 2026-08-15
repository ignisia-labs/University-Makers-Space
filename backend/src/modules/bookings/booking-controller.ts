import type { Request, Response } from "express";
import { created, ok } from "../../utils/api-response.js";
import * as service from "./booking-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query, req.user);
  return ok(res, "Booking list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "Booking found", await service.get(req.params.id!, req.user));
}

export async function create(req: Request, res: Response) {
  return created(res, "Booking created", await service.create(req.user!.id, req.body));
}

export async function updateStatus(req: Request, res: Response) {
  return ok(res, "Booking updated", await service.updateStatus(req.params.id!, req.body.status, req.body.notes));
}
