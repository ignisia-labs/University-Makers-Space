import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./reference-data-controller.js";
import { equipmentCategoriesQuerySchema, programmesQuerySchema } from "./reference-data-schema.js";

export const referenceDataRoutes = Router();

referenceDataRoutes.use(authenticate);
referenceDataRoutes.get("/departments", asyncHandler(controller.departments));
referenceDataRoutes.get(
  "/programmes",
  validate(programmesQuerySchema),
  asyncHandler(controller.programmes),
);
referenceDataRoutes.get("/academic-years", asyncHandler(controller.academicYears));
referenceDataRoutes.get("/labs", asyncHandler(controller.labs));
referenceDataRoutes.get(
  "/equipment-categories",
  validate(equipmentCategoriesQuerySchema),
  asyncHandler(controller.equipmentCategories),
);
