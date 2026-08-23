import type { Request, Response } from "express";
import { noContent, ok } from "../../utils/api-response.js";
import * as service from "./lab-service.js";

export async function configuration(req: Request, res: Response) {
  return ok(res, "MakerSpace configuration", await service.getConfiguration(req.params.labId!));
}

export async function updateConfiguration(req: Request, res: Response) {
  return ok(
    res,
    "MakerSpace configuration saved",
    await service.updateConfiguration(req.params.labId!, req.body, req.user!.id),
  );
}

export async function upsertDateException(req: Request, res: Response) {
  return ok(
    res,
    "Operating-date exception saved",
    await service.upsertDateException(req.params.labId!, req.body, req.user!.id),
  );
}

export async function deleteDateException(req: Request, res: Response) {
  await service.deleteDateException(req.params.labId!, req.params.exceptionId!, req.user!.id);
  return noContent(res);
}

export async function regenerateSlots(req: Request, res: Response) {
  return ok(
    res,
    "MakerSpace slots regenerated",
    await service.regenerateSlots(
      req.params.labId!,
      req.body.fromDate,
      req.body.toDate,
      req.user!.id,
    ),
  );
}

export async function availabilityDates(req: Request, res: Response) {
  return ok(
    res,
    "MakerSpace operating dates",
    await service.availabilityDates(
      req.params.labId!,
      req.query.projectId as string | undefined,
      Number(req.query.participantCount),
      req.user!,
    ),
  );
}

export async function dailyAvailability(req: Request, res: Response) {
  return ok(
    res,
    "MakerSpace slot availability",
    await service.dailyAvailability(
      req.params.labId!,
      String(req.query.date),
      req.query.projectId as string | undefined,
      Number(req.query.participantCount),
      req.user!,
    ),
  );
}
