import type { Request, Response } from "express";
import { hasPermission } from "../../config/permissions.js";
import { created, ok } from "../../utils/api-response.js";
import * as service from "./claim-service.js";

export async function allowance(req: Request, res: Response) {
  return ok(
    res,
    "Material allowance",
    await service.allowanceFor(req.params.projectId!, req.user!),
  );
}

export async function create(req: Request, res: Response) {
  const result = await service.create(req.user!, req.body, requestContext(req));
  if (result.replayed) return ok(res, "Claim already submitted", result.claim);
  return created(res, "Claim submitted", result.claim);
}

export async function decide(req: Request, res: Response) {
  return ok(
    res,
    req.body.decision === "ISSUED" ? "Material issued" : "Claim declined",
    await service.decide(
      req.params.id!,
      req.body.decision,
      req.body.reason,
      req.user!,
      requestContext(req),
    ),
  );
}

export async function cancel(req: Request, res: Response) {
  return ok(res, "Claim withdrawn", await service.cancel(req.params.id!, req.user!));
}

export async function list(req: Request, res: Response) {
  const operational = hasPermission(req.user!.roles, "consumable.manage");
  const result = await service.list(req.query, req.user!, operational);
  return ok(res, "Material claims", result.data, result.meta);
}

function requestContext(req: Request) {
  return { requestId: req.requestId, ipAddress: req.ip, userAgent: req.get("user-agent") };
}
