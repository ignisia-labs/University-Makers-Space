import type { Request, Response } from "express";
import { created, ok } from "../../utils/api-response.js";
import * as service from "./booking-service.js";

export async function list(req: Request, res: Response) {
  const result = await service.list(req.query, req.user!);
  return ok(res, "Booking list", result.data, result.meta);
}

export async function get(req: Request, res: Response) {
  return ok(res, "Booking found", await service.get(req.params.id!, req.user!));
}

export async function create(req: Request, res: Response) {
  const result = await service.create(req.user!, req.body, requestContext(req));
  if (result.replayed) return ok(res, "Booking already created", result);
  return created(res, "Booking created", result);
}

export async function cancel(req: Request, res: Response) {
  const result = await service.cancel(
    req.params.id!,
    req.body.reason,
    req.body.idempotencyKey,
    req.user!,
    requestContext(req),
  );
  return ok(
    res,
    result.replayed ? "Booking already cancelled" : "Booking cancelled",
    result.booking,
  );
}

export async function updateStatus(req: Request, res: Response) {
  return ok(
    res,
    "Booking updated",
    await service.updateStatus(
      req.params.id!,
      req.body.status,
      req.body.notes,
      req.user!,
      requestContext(req),
    ),
  );
}

export async function complete(req: Request, res: Response) {
  return ok(
    res,
    "Session ended",
    await service.completeOwnBooking(req.params.id!, req.user!, requestContext(req)),
  );
}

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}
