import type { Request, Response } from "express";
import { ok } from "../../utils/api-response.js";
import * as service from "./reference-data-service.js";

export async function departments(_req: Request, res: Response) {
  return ok(res, "Active departments", await service.listDepartments());
}

export async function programmes(req: Request, res: Response) {
  return ok(
    res,
    "Active programmes",
    await service.listProgrammes(req.query.departmentId as string | undefined),
  );
}

export async function academicYears(_req: Request, res: Response) {
  return ok(res, "Active academic years", await service.listAcademicYears());
}

export async function labs(_req: Request, res: Response) {
  return ok(res, "Active labs", await service.listLabs());
}

export async function equipmentCategories(req: Request, res: Response) {
  return ok(
    res,
    "Active equipment categories",
    await service.listEquipmentCategories(req.query.labId as string | undefined),
  );
}

export async function projectResources(req: Request, res: Response) {
  return ok(
    res,
    "Configured project resources",
    await service.listProjectResources(String(req.query.labId)),
  );
}
