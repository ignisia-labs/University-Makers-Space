import type { Request, Response } from "express";
import { created, noContent, ok } from "../../utils/api-response.js";
import { projectDto } from "../../utils/serializers.js";
import * as service from "./project-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query, req.user!);
  return ok(res, "Project list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "Project found", projectDto(await service.get(req.params.id!, req.user!)));
}

export async function create(req: Request, res: Response) {
  return created(res, "Project created", await service.create(req.user!.id, req.body));
}

export async function update(req: Request, res: Response) {
  return ok(res, "Project updated", await service.update(req.params.id!, req.body, req.user!));
}

export async function addMember(req: Request, res: Response) {
  return created(
    res,
    "Project member invited",
    await service.inviteMember(req.params.id!, req.body.email, req.user!),
  );
}

export async function requestMentor(req: Request, res: Response) {
  return created(
    res,
    "Mentor approval requested",
    await service.requestMentor(req.params.id!, req.body.facultyId, req.user!),
  );
}

export async function decideMentor(req: Request, res: Response) {
  return ok(
    res,
    "Mentor decision recorded",
    await service.decideMentorRequest(
      req.params.id!,
      req.body.decision,
      req.body.reason,
      req.user!,
    ),
  );
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id!, req.user!);
  return noContent(res);
}
