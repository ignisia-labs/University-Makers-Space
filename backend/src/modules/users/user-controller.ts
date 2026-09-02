import type { Request, Response } from "express";
import { created, noContent, ok } from "../../utils/api-response.js";
import { userDto } from "../../utils/serializers.js";
import * as service from "./user-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query);
  return ok(res, "User list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "User found", userDto(await service.get(req.params.id!)));
}

export async function update(req: Request, res: Response) {
  return ok(res, "User updated", await service.update(req.params.id!, req.body, req.user!.id));
}

export async function updateRoles(req: Request, res: Response) {
  return ok(
    res,
    "User roles updated; active sessions revoked",
    await service.updateRoles(req.params.id!, req.body.roles, req.user!.id),
  );
}

export async function unlinkGoogleIdentity(req: Request, res: Response) {
  return ok(
    res,
    "Google identity unlinked — the next sign-in will re-link this account",
    await service.unlinkGoogleIdentity(req.params.id!, req.user!.id),
  );
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id!, req.user!.id);
  return noContent(res);
}

export async function listProvisioning(req: Request, res: Response) {
  const result = await service.listProvisioning(req.query);
  return ok(res, "Provisioning list", result.data, result.meta);
}

export async function createProvisioning(req: Request, res: Response) {
  return created(
    res,
    "Institutional account provisioned",
    await service.createProvisioning(req.body, req.user!.id),
  );
}

export async function updateProvisioning(req: Request, res: Response) {
  return ok(
    res,
    "Provisioning updated",
    await service.updateProvisioning(req.params.id!, req.body, req.user!.id),
  );
}

export async function searchFacultyMentors(req: Request, res: Response) {
  const result = await service.searchFacultyMentors(req.query, req.user!.id);
  return ok(res, "Faculty Mentor search results", result.data, result.meta);
}

export async function searchStudents(req: Request, res: Response) {
  const result = await service.searchStudents(req.query, req.user!.id);
  return ok(res, "Student search results", result.data, result.meta);
}

export async function updateOwnStudentProfile(req: Request, res: Response) {
  return ok(
    res,
    "Student profile updated",
    await service.updateOwnStudentProfile(req.user!.id, req.body),
  );
}
