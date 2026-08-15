import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import hpp from "hpp";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { env, isProduction } from "./config/env.js";
import { logger } from "./config/logger.js";
import { authenticate } from "./middleware/auth.js";
import { enforceHttps } from "./middleware/https.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { sanitizeRequest } from "./middleware/sanitize.js";
import { authRoutes } from "./modules/auth/auth-routes.js";
import { bookingRoutes } from "./modules/bookings/booking-routes.js";
import { equipmentRoutes } from "./modules/equipment/equipment-routes.js";
import { eventRoutes } from "./modules/events/event-routes.js";
import { notificationRoutes } from "./modules/notifications/notification-routes.js";
import { projectRoutes } from "./modules/projects/project-routes.js";
import { uploadRoutes } from "./modules/uploads/upload-routes.js";
import { userRoutes } from "./modules/users/user-routes.js";

const docsPath = path.resolve(process.cwd(), "docs/openapi.yaml");
const openApi = YAML.parse(fs.readFileSync(docsPath, "utf8"));

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(enforceHttps);
  app.use(requestId);
  app.use(pinoHttp({ logger, customProps: (req) => ({ requestId: req.id }) }));
  app.use(helmet());
  app.use(cors({
    origin: [env.FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(sanitizeRequest);

  app.get("/health", (_req, res) => res.status(200).json({ success: true, message: "OK", data: { status: "ok" } }));
  if (!isProduction) app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApi));

  const api = express.Router();
  api.use(rateLimit({ prefix: "general", windowSeconds: 900, max: 200 }));
  api.use("/auth", authRoutes);
  api.use("/users", userRoutes);
  api.use("/equipment", equipmentRoutes);
  api.use("/bookings", bookingRoutes);
  api.use("/projects", projectRoutes);
  api.use("/events", eventRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/uploads", authenticate, rateLimit({ prefix: "uploads", windowSeconds: 3600, max: 20 }), uploadRoutes);
  app.use("/api/v1", api);
  app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found", error: { code: "NOT_FOUND", details: [] } }));
  app.use(errorHandler);
  return app;
}
