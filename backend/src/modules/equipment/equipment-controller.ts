import type { Request, Response } from "express";
import { created, noContent, ok } from "../../utils/api-response.js";
import * as service from "./equipment-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query);
  return ok(res, "Equipment list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "Equipment found", await service.get(req.params.id!));
}

export async function create(req: Request, res: Response) {
  return created(res, "Equipment created", await service.create(req.body));
}

export async function update(req: Request, res: Response) {
  return ok(res, "Equipment updated", await service.update(req.params.id!, req.body));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id!);
  return noContent(res);
}
