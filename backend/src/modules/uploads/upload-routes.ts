import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { idParamsSchema } from "../shared/schemas.js";
import * as controller from "./upload-controller.js";

export const uploadRoutes = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

uploadRoutes.post(
  "/",
  authenticate,
  authorize("upload.create"),
  upload.single("file"),
  asyncHandler(controller.create),
);
uploadRoutes.delete(
  "/:id",
  authenticate,
  authorize("upload.create"),
  validate(idParamsSchema),
  asyncHandler(controller.remove),
);
