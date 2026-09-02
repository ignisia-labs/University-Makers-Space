import type { Request, Response } from "express";
import { ApiError } from "../../utils/api-error.js";
import { created, ok } from "../../utils/api-response.js";
import * as audit from "./audit-service.js";
import * as dashboards from "./dashboard-service.js";
import * as exports_ from "./export-service.js";
import * as faculty from "./faculty-service.js";
import { parseFacultyWorkbook } from "./faculty-import.js";
import * as reference from "./reference-admin-service.js";

function context(req: Request) {
  return { requestId: req.requestId, ipAddress: req.ip, userAgent: req.get("user-agent") };
}

export async function dashboard(req: Request, res: Response) {
  return ok(res, "Operational dashboard", await dashboards.dashboard(req.params.labId!, req.user!));
}

export async function auditLogs(req: Request, res: Response) {
  const result = await audit.list(req.query, req.user!);
  return ok(res, "Audit log", result.data, result.meta);
}

export async function auditActions(req: Request, res: Response) {
  return ok(res, "Audit actions", await audit.actions(req.user!));
}

export async function exportCsv(req: Request, res: Response) {
  await exports_.streamCsv(
    req.params.kind as exports_.ExportKind,
    req.query as { labId?: string; from?: string; to?: string },
    req.user!,
    res,
  );
}

export async function listDepartments(_req: Request, res: Response) {
  return ok(res, "Departments", await reference.listDepartments());
}
export async function createDepartment(req: Request, res: Response) {
  return created(
    res,
    "Department created",
    await reference.createDepartment(req.body, req.user!, context(req)),
  );
}
export async function updateDepartment(req: Request, res: Response) {
  return ok(
    res,
    "Department updated",
    await reference.updateDepartment(req.params.id!, req.body, req.user!, context(req)),
  );
}

export async function deleteDepartment(req: Request, res: Response) {
  return ok(
    res,
    "Department deleted",
    await reference.deleteDepartment(req.params.id!, req.user!, context(req)),
  );
}

export async function listProgrammes(req: Request, res: Response) {
  return ok(
    res,
    "Programmes",
    await reference.listProgrammes(req.query.labId as string | undefined),
  );
}
export async function createProgramme(req: Request, res: Response) {
  return created(
    res,
    "Programme created",
    await reference.createProgramme(req.body, req.user!, context(req)),
  );
}
export async function updateProgramme(req: Request, res: Response) {
  return ok(
    res,
    "Programme updated",
    await reference.updateProgramme(req.params.id!, req.body, req.user!, context(req)),
  );
}

export async function deleteProgramme(req: Request, res: Response) {
  return ok(
    res,
    "Programme deleted",
    await reference.deleteProgramme(req.params.id!, req.user!, context(req)),
  );
}

export async function listAcademicYears(_req: Request, res: Response) {
  return ok(res, "Academic years", await reference.listAcademicYears());
}
export async function saveAcademicYear(req: Request, res: Response) {
  return ok(
    res,
    "Academic year saved",
    await reference.upsertAcademicYear(req.body, req.user!, context(req)),
  );
}

export async function listEquipmentCategories(req: Request, res: Response) {
  return ok(
    res,
    "Equipment categories",
    await reference.listEquipmentCategories(req.query.labId as string | undefined),
  );
}
export async function createEquipmentCategory(req: Request, res: Response) {
  return created(
    res,
    "Equipment category created",
    await reference.createEquipmentCategory(req.body, req.user!, context(req)),
  );
}
export async function updateEquipmentCategory(req: Request, res: Response) {
  return ok(
    res,
    "Equipment category updated",
    await reference.updateEquipmentCategory(req.params.id!, req.body, req.user!, context(req)),
  );
}

export async function listConsumableCategories(req: Request, res: Response) {
  return ok(
    res,
    "Consumable categories",
    await reference.listConsumableCategories(req.query.labId as string | undefined),
  );
}
export async function createConsumableCategory(req: Request, res: Response) {
  return created(
    res,
    "Consumable category created",
    await reference.createConsumableCategory(req.body, req.user!, context(req)),
  );
}
export async function updateConsumableCategory(req: Request, res: Response) {
  return ok(
    res,
    "Consumable category updated",
    await reference.updateConsumableCategory(req.params.id!, req.body, req.user!, context(req)),
  );
}

export async function listDomains(req: Request, res: Response) {
  return ok(res, "Domains", await reference.listDomains(req.query.labId as string));
}
export async function createDomain(req: Request, res: Response) {
  return created(
    res,
    "Domain created",
    await reference.createDomain(req.body, req.user!, context(req)),
  );
}
export async function updateDomain(req: Request, res: Response) {
  return ok(
    res,
    "Domain updated",
    await reference.updateDomain(req.params.id!, req.body, req.user!, context(req)),
  );
}
export async function deleteDomain(req: Request, res: Response) {
  return ok(
    res,
    "Domain removed",
    await reference.deleteDomain(req.params.id!, req.user!, context(req)),
  );
}

export async function listConsumables(req: Request, res: Response) {
  return ok(
    res,
    "Consumables",
    await reference.listConsumables(req.query.labId as string | undefined),
  );
}
export async function createConsumable(req: Request, res: Response) {
  return created(
    res,
    "Consumable created",
    await reference.createConsumable(req.body, req.user!, context(req)),
  );
}
export async function updateConsumable(req: Request, res: Response) {
  return ok(
    res,
    "Consumable updated",
    await reference.updateConsumable(req.params.id!, req.body, req.user!, context(req)),
  );
}

// ─── divisions and faculty ───────────────────────────────────────────────────

export async function listDivisions(_req: Request, res: Response) {
  return ok(res, "Divisions", await faculty.listDivisions());
}
export async function createDivision(req: Request, res: Response) {
  return created(
    res,
    "Division created",
    await faculty.createDivision(req.body, req.user!, context(req)),
  );
}
export async function updateDivision(req: Request, res: Response) {
  return ok(
    res,
    "Division updated",
    await faculty.updateDivision(req.params.id!, req.body, req.user!, context(req)),
  );
}
export async function deleteDivision(req: Request, res: Response) {
  return ok(
    res,
    "Division deleted",
    await faculty.deleteDivision(req.params.id!, req.user!, context(req)),
  );
}

export async function listFaculty(req: Request, res: Response) {
  const result = await faculty.listFaculty(req.query);
  return ok(res, "Faculty", result.data, result.meta);
}
export async function addFaculty(req: Request, res: Response) {
  return created(
    res,
    "Faculty added",
    await faculty.upsertFaculty(req.body, req.user!, context(req)),
  );
}
export async function updateFaculty(req: Request, res: Response) {
  return ok(
    res,
    "Faculty updated",
    await faculty.updateFaculty(req.params.id!, req.body, req.user!, context(req)),
  );
}
export async function removeFaculty(req: Request, res: Response) {
  return ok(
    res,
    "Faculty removed",
    await faculty.removeFaculty(req.params.id!, req.user!, context(req)),
  );
}

export async function importFaculty(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw new ApiError(400, "FILE_REQUIRED", "Attach an .xlsx workbook to import");
  const rows = await parseFacultyWorkbook(file.buffer);
  const outcome = await faculty.importFaculty(rows, req.user!, context(req));
  return ok(res, `Imported ${outcome.added + outcome.updated} of ${rows.length} rows`, {
    ...outcome,
    total: rows.length,
  });
}
