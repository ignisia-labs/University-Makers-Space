import type { Request, Response } from "express";
import { created, noContent, ok } from "../../utils/api-response.js";
import * as service from "./event-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query);
  return ok(res, "Event list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "Event found", await service.get(req.params.id!));
}

export async function create(req: Request, res: Response) {
  return created(res, "Event created", await service.create(req.user!.id, req.body));
}

export async function update(req: Request, res: Response) {
  return ok(res, "Event updated", await service.update(req.params.id!, req.body));
}

export async function register(req: Request, res: Response) {
  return created(
    res,
    "Event registration created",
    await service.register(req.params.id!, req.user!.id),
  );
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id!);
  return noContent(res);
}
