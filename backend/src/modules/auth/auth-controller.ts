import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { permissionsFor } from "../../config/permissions.js";
import { created, noContent, ok } from "../../utils/api-response.js";
import { userDto } from "../../utils/serializers.js";
import * as service from "./auth-service.js";
import { prnPolicy } from "../users/prn-policy.js";

export function googleConfig(_req: Request, res: Response) {
  return ok(res, "Google identity configuration", {
    clientId: env.GOOGLE_CLIENT_ID,
    hostedDomain: env.GOOGLE_HOSTED_DOMAIN,
  });
}

export function studentProfileConfig(_req: Request, res: Response) {
  return ok(res, "Student profile policy", { prn: prnPolicy });
}

export function loginCsrf(_req: Request, res: Response) {
  return ok(res, "Login CSRF token", { csrfToken: service.createLoginCsrf(res) });
}

export async function googleSignIn(req: Request, res: Response) {
  const { user, accessToken } = await service.googleSignIn(
    req.body.credential,
    req.body.csrfToken,
    req.cookies[service.authCookieNames.loginCsrf],
    { ip: req.ip, userAgent: req.header("user-agent"), requestId: req.requestId },
    res,
  );
  return ok(res, "Google sign-in successful", {
    user: userDto(user),
    permissions: permissionsFor(user.roles),
    accessToken,
    next: user.profileComplete ? "dashboard" : "onboarding",
  });
}

export async function refresh(req: Request, res: Response) {
  const accessToken = await service.refresh(req.cookies[service.authCookieNames.refresh], res);
  return ok(res, "Access token refreshed", { accessToken });
}

export async function logout(req: Request, res: Response) {
  await service.logout(req.user!.id, req.user!.sessionId, res);
  return noContent(res);
}

export async function me(req: Request, res: Response) {
  const user = await service.getCurrentUser(req.user!.id);
  return ok(res, "Current user", {
    user: userDto(user),
    permissions: permissionsFor(user.roles),
  });
}

export async function onboarding(req: Request, res: Response) {
  const profile = await service.completeOnboarding(req.user!.id, req.body);
  return created(res, "Student profile completed", profile);
}
