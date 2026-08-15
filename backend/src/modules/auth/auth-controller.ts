import type { Request, Response } from "express";
import { ok, created, noContent } from "../../utils/api-response.js";
import { userDto } from "../../utils/serializers.js";
import * as service from "./auth-service.js";

export async function register(req: Request, res: Response) {
  const user = await service.register(req.body);
  return created(res, "Account created", userDto(user));
}

export async function login(req: Request, res: Response) {
  const { user, accessToken } = await service.login(req.body.email, req.body.password, res);
  return ok(res, "Login successful", { user: userDto(user), accessToken });
}

export async function refresh(req: Request, res: Response) {
  const accessToken = await service.refresh(req.cookies.refreshToken, res);
  return ok(res, "Access token refreshed", { accessToken });
}

export async function logout(req: Request, res: Response) {
  await service.logout(req.user!.id, res);
  return noContent(res);
}

export async function me(req: Request, res: Response) {
  const { id, email, roles, isActive } = req.user!;
  return ok(res, "Current user", { id, email, roles, isActive });
}
