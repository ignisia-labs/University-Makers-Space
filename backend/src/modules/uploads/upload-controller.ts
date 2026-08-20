import type { Request, Response } from "express";
import { created, noContent } from "../../utils/api-response.js";
import * as service from "./upload-service.js";

export async function create(req: Request, res: Response) {
  return created(res, "File uploaded", await service.upload(req.user!.id, req.file));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.user!.id, req.params.id!);
  return noContent(res);
}
