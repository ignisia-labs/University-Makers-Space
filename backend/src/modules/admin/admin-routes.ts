import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { idParamsSchema } from "../shared/schemas.js";
import * as controller from "./admin-controller.js";
import {
  academicYearSchema,
  addFacultySchema,
  createDivisionSchema,
  listFacultySchema,
  updateDivisionSchema,
  updateFacultySchema,
  auditListSchema,
  createCategorySchema,
  createConsumableSchema,
  createDomainSchema,
  updateDomainSchema,
  createDepartmentSchema,
  createProgrammeSchema,
  exportSchema,
  labScopedListSchema,
  updateCategorySchema,
  updateConsumableSchema,
  updateDepartmentSchema,
  updateProgrammeSchema,
} from "./admin-schema.js";

export const adminRoutes = Router();

/** Exports are the heaviest read in the system; keep them scarce per operator. */
const exportLimiter = rateLimit({ prefix: "report-export", windowSeconds: 3600, max: 30 });
const referenceWriteLimiter = rateLimit({ prefix: "reference-write", windowSeconds: 60, max: 60 });
/** Imports are heavy and rare; a low ceiling is plenty and bounds the damage of
 *  a runaway script. 2 MB fits thousands of staff rows. */
const importLimiter = rateLimit({ prefix: "faculty-import", windowSeconds: 3600, max: 20 });
const workbookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

adminRoutes.use(authenticate);
// Administration responses are per-operator and must never land in a shared cache.
adminRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

adminRoutes.get(
  "/audit-logs",
  authorize("audit.read"),
  validate(auditListSchema),
  asyncHandler(controller.auditLogs),
);
adminRoutes.get(
  "/audit-logs/actions",
  authorize("audit.read"),
  asyncHandler(controller.auditActions),
);

adminRoutes.get(
  "/exports/:kind",
  authorize("report.export"),
  exportLimiter,
  validate(exportSchema),
  asyncHandler(controller.exportCsv),
);

// ─── reference data administration ───────────────────────────────────────────

adminRoutes.get(
  "/reference/departments",
  authorize("reference_data.manage"),
  asyncHandler(controller.listDepartments),
);
adminRoutes.post(
  "/reference/departments",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(createDepartmentSchema),
  asyncHandler(controller.createDepartment),
);
adminRoutes.patch(
  "/reference/departments/:id",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(updateDepartmentSchema),
  asyncHandler(controller.updateDepartment),
);

adminRoutes.delete(
  "/reference/departments/:id",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(idParamsSchema),
  asyncHandler(controller.deleteDepartment),
);

adminRoutes.get(
  "/reference/programmes",
  authorize("reference_data.manage"),
  validate(labScopedListSchema),
  asyncHandler(controller.listProgrammes),
);
adminRoutes.post(
  "/reference/programmes",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(createProgrammeSchema),
  asyncHandler(controller.createProgramme),
);
adminRoutes.patch(
  "/reference/programmes/:id",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(updateProgrammeSchema),
  asyncHandler(controller.updateProgramme),
);

adminRoutes.delete(
  "/reference/programmes/:id",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(idParamsSchema),
  asyncHandler(controller.deleteProgramme),
);

adminRoutes.get(
  "/reference/academic-years",
  authorize("reference_data.manage"),
  asyncHandler(controller.listAcademicYears),
);
adminRoutes.put(
  "/reference/academic-years",
  authorize("reference_data.manage"),
  referenceWriteLimiter,
  validate(academicYearSchema),
  asyncHandler(controller.saveAcademicYear),
);

adminRoutes.get(
  "/reference/equipment-categories",
  authorize("equipment.manage"),
  validate(labScopedListSchema),
  asyncHandler(controller.listEquipmentCategories),
);
adminRoutes.post(
  "/reference/equipment-categories",
  authorize("equipment.manage"),
  referenceWriteLimiter,
  validate(createCategorySchema),
  asyncHandler(controller.createEquipmentCategory),
);
adminRoutes.patch(
  "/reference/equipment-categories/:id",
  authorize("equipment.manage"),
  referenceWriteLimiter,
  validate(updateCategorySchema),
  asyncHandler(controller.updateEquipmentCategory),
);

adminRoutes.get(
  "/reference/consumable-categories",
  authorize("consumable.manage"),
  validate(labScopedListSchema),
  asyncHandler(controller.listConsumableCategories),
);
adminRoutes.post(
  "/reference/consumable-categories",
  authorize("consumable.manage"),
  referenceWriteLimiter,
  validate(createCategorySchema),
  asyncHandler(controller.createConsumableCategory),
);
adminRoutes.patch(
  "/reference/consumable-categories/:id",
  authorize("consumable.manage"),
  referenceWriteLimiter,
  validate(updateCategorySchema),
  asyncHandler(controller.updateConsumableCategory),
);

// Domains group the catalogue. Anyone who keeps the catalogue keeps these.
adminRoutes.get(
  "/reference/domains",
  authorize("equipment.manage"),
  validate(labScopedListSchema),
  asyncHandler(controller.listDomains),
);
adminRoutes.post(
  "/reference/domains",
  authorize("equipment.manage"),
  referenceWriteLimiter,
  validate(createDomainSchema),
  asyncHandler(controller.createDomain),
);
adminRoutes.patch(
  "/reference/domains/:id",
  authorize("equipment.manage"),
  referenceWriteLimiter,
  validate(updateDomainSchema),
  asyncHandler(controller.updateDomain),
);
adminRoutes.delete(
  "/reference/domains/:id",
  authorize("equipment.manage"),
  referenceWriteLimiter,
  validate(idParamsSchema),
  asyncHandler(controller.deleteDomain),
);

adminRoutes.get(
  "/reference/consumables",
  authorize("consumable.manage"),
  validate(labScopedListSchema),
  asyncHandler(controller.listConsumables),
);
adminRoutes.post(
  "/reference/consumables",
  authorize("consumable.manage"),
  referenceWriteLimiter,
  validate(createConsumableSchema),
  asyncHandler(controller.createConsumable),
);
adminRoutes.patch(
  "/reference/consumables/:id",
  authorize("consumable.manage"),
  referenceWriteLimiter,
  validate(updateConsumableSchema),
  asyncHandler(controller.updateConsumable),
);

// ─── divisions and faculty (Super Admin) ─────────────────────────────────────

adminRoutes.get("/divisions", authorize("faculty.manage"), asyncHandler(controller.listDivisions));
adminRoutes.post(
  "/divisions",
  authorize("faculty.manage"),
  referenceWriteLimiter,
  validate(createDivisionSchema),
  asyncHandler(controller.createDivision),
);
adminRoutes.patch(
  "/divisions/:id",
  authorize("faculty.manage"),
  referenceWriteLimiter,
  validate(updateDivisionSchema),
  asyncHandler(controller.updateDivision),
);
adminRoutes.delete(
  "/divisions/:id",
  authorize("faculty.manage"),
  referenceWriteLimiter,
  validate(idParamsSchema),
  asyncHandler(controller.deleteDivision),
);

adminRoutes.get(
  "/faculty",
  authorize("faculty.manage"),
  validate(listFacultySchema),
  asyncHandler(controller.listFaculty),
);
adminRoutes.post(
  "/faculty",
  authorize("faculty.manage"),
  referenceWriteLimiter,
  validate(addFacultySchema),
  asyncHandler(controller.addFaculty),
);
adminRoutes.post(
  "/faculty/import",
  authorize("faculty.manage"),
  importLimiter,
  workbookUpload.single("file"),
  asyncHandler(controller.importFaculty),
);
adminRoutes.patch(
  "/faculty/:id",
  authorize("faculty.manage"),
  referenceWriteLimiter,
  validate(updateFacultySchema),
  asyncHandler(controller.updateFaculty),
);
adminRoutes.delete(
  "/faculty/:id",
  authorize("faculty.manage"),
  referenceWriteLimiter,
  validate(idParamsSchema),
  asyncHandler(controller.removeFaculty),
);
