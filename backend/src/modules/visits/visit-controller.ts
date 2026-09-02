import type { Request, Response } from "express";
import { created, ok } from "../../utils/api-response.js";
import * as console_ from "./console-service.js";
import * as quickVisits from "./quick-visit-service.js";
import * as visits from "./visit-service.js";

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

export async function createQuickVisit(req: Request, res: Response) {
  const result = await quickVisits.create(req.user!, req.body, requestContext(req));
  if (result.replayed) return ok(res, "Quick Visit already requested", result.quickVisit);
  return created(res, "Quick Visit requested", result.quickVisit);
}

export async function listQuickVisits(req: Request, res: Response) {
  const result = await quickVisits.list(req.query, req.user!);
  return ok(res, "Quick Visit list", result.data, result.meta);
}

export async function getQuickVisit(req: Request, res: Response) {
  return ok(res, "Quick Visit found", await quickVisits.get(req.params.id!, req.user!));
}

export async function decideQuickVisit(req: Request, res: Response) {
  return ok(
    res,
    req.body.decision === "APPROVED" ? "Quick Visit approved" : "Quick Visit declined",
    await quickVisits.decide(
      req.params.id!,
      req.body.decision,
      req.body.reason,
      req.user!,
      requestContext(req),
    ),
  );
}

export async function cancelQuickVisit(req: Request, res: Response) {
  const result = await quickVisits.cancel(
    req.params.id!,
    req.body.reason,
    req.body.idempotencyKey,
    req.user!,
    requestContext(req),
  );
  return ok(
    res,
    result.replayed ? "Quick Visit already cancelled" : "Quick Visit cancelled",
    result.quickVisit,
  );
}

export async function checkIn(req: Request, res: Response) {
  const result = await visits.checkIn(req.user!, req.body, requestContext(req));
  if (result.replayed) return ok(res, "Attendance already recorded", result.visit);
  return created(res, "Checked in", result.visit);
}

export async function checkOut(req: Request, res: Response) {
  const result = await visits.checkOut(req.params.id!, req.body, req.user!, requestContext(req));
  return ok(res, result.replayed ? "Already checked out" : "Checked out", result.visit);
}

export async function listVisits(req: Request, res: Response) {
  const result = await visits.list(req.query, req.user!);
  return ok(res, "Visit history", result.data, result.meta);
}

export async function getVisit(req: Request, res: Response) {
  return ok(res, "Visit found", await visits.get(req.params.id!, req.user!));
}

export async function occupancy(req: Request, res: Response) {
  return ok(res, "Live occupancy", await console_.occupancy(req.params.labId!, req.user!));
}

export async function roster(req: Request, res: Response) {
  return ok(
    res,
    "MakerSpace console",
    await console_.roster(req.params.labId!, req.query.date as string | undefined, req.user!),
  );
}
