process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ums_test?schema=public";
process.env.JWT_SECRET = "12345678901234567890123456789012";
process.env.JWT_REFRESH_SECRET = "abcdefghijklmnopqrstuvwxzy123456";
process.env.GOOGLE_CLIENT_ID = "1234567890-test.apps.googleusercontent.com";
process.env.GOOGLE_HOSTED_DOMAIN = "mitwpu.edu.in";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.CLOUDINARY_CLOUD_NAME = "test";
process.env.CLOUDINARY_API_KEY = "test";
process.env.CLOUDINARY_API_SECRET = "test";
process.env.FRONTEND_URL = "http://localhost:5173";

import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app.js";

const userId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const sessionId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const labId = "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const now = new Date("2026-08-23T12:00:00.000Z");
let mockRole: UserRole = UserRole.STUDENT;

const schedules = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  id: `${dayOfWeek}f5c6a30-8db5-4f06-90f6-1eb4e664b2f`,
  labId,
  dayOfWeek,
  opensAtMinute: 510,
  closesAtMinute: 1110,
  isOpen: true,
}));
const lab = {
  id: labId,
  name: "MIT-WPU MakerSpace",
  code: "MAKERSPACE",
  description: "University prototyping facility",
  timeZone: "Asia/Kolkata",
  slotDurationMinutes: 60,
  bookingCapacity: 20,
  quickVisitCapacity: 10,
  quickVisitsEnabled: true,
  bookingHorizonDays: 14,
  cancellationWindowHours: 2,
  maxFutureBookingsPerProject: null,
  projectVerificationRequired: true,
  configurationVersion: 1,
  isActive: true,
  createdById: null,
  createdAt: now,
  updatedAt: now,
  schedules,
};

jest.mock("../../src/config/db", () => ({
  prisma: {
    session: {
      findFirst: jest.fn(async () => ({
        id: sessionId,
        user: {
          id: userId,
          name: "Test User",
          email: "user@mitwpu.edu.in",
          roles: [mockRole],
          profileComplete: true,
          isActive: true,
          deletedAt: null,
        },
      })),
    },
    lab: { findUnique: jest.fn(async () => lab) },
    labDateException: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock("../../src/config/redis", () => ({
  redis: {
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(async () => 0),
    zadd: jest.fn(),
    expire: jest.fn(),
  },
}));

function accessToken() {
  return jwt.sign({ sub: userId, sid: sessionId, type: "access" }, process.env.JWT_SECRET!, {
    expiresIn: "15m",
  });
}

describe("Phase 3 lab availability API", () => {
  beforeEach(() => {
    mockRole = UserRole.STUDENT;
  });

  it("allows Students to read a bounded server-derived operating-date window", async () => {
    const response = await request(createApp())
      .get(`/api/v1/labs/${labId}/availability/dates?participantCount=4`)
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.lab).toMatchObject({ id: labId, bookingCapacity: 20 });
    expect(response.body.data.dates).toHaveLength(15);
    expect(response.body.data.dates[0]).toMatchObject({
      isOpen: true,
      slotCount: 10,
      canFit: true,
    });
  });

  it("denies configuration reads to Students", async () => {
    const response = await request(createApp())
      .get(`/api/v1/labs/${labId}/configuration`)
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows a provisioned Admin to read configuration", async () => {
    mockRole = UserRole.ADMIN;
    const response = await request(createApp())
      .get(`/api/v1/labs/${labId}/configuration`)
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: labId,
      configurationVersion: 1,
      bookingCapacity: 20,
    });
    expect(response.body.data.weeklySchedule).toHaveLength(7);
  });

  it("rejects invalid participant counts before querying availability", async () => {
    const response = await request(createApp())
      .get(`/api/v1/labs/${labId}/availability/dates?participantCount=0`)
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
