import type { Request, Response } from "express";
import { created, noContent, ok } from "../../utils/api-response.js";
import * as service from "./project-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query);
  return ok(res, "Project list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "Project found", await service.get(req.params.id!));
}

export async function create(req: Request, res: Response) {
  return created(res, "Project created", await service.create(req.user!.id, req.body));
}

export async function update(req: Request, res: Response) {
  return ok(res, "Project updated", await service.update(req.params.id!, req.body));
}

export async function addMember(req: Request, res: Response) {
  return created(res, "Project member added", await service.addMember(req.params.id!, req.body.userId, req.body.role));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id!);
  return noContent(res);
}
