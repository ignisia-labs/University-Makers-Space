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
process.env.FRONTEND_URL = "http://localhost:8081";

import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";

const userId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const sessionId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const departmentId = "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";

jest.mock("../../src/config/db", () => ({
  prisma: {
    session: {
      findFirst: jest.fn(async () => ({
        id: sessionId,
        user: {
          id: userId,
          email: "student@mitwpu.edu.in",
          roles: [UserRole.STUDENT],
          profileComplete: false,
          isActive: true,
          deletedAt: null,
        },
      })),
    },
    department: {
      findMany: jest.fn(async () => [{ id: departmentId, code: "CSE", name: "Computer Science" }]),
    },
    programme: {
      findMany: jest.fn(async () => [
        {
          id: "af5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
          departmentId,
          code: "BTECH-CSE",
          name: "B.Tech CSE",
        },
      ]),
    },
    academicYearOption: {
      findMany: jest.fn(async () => [
        { id: "bf5c6a30-8db5-4f06-90f6-1eb4e664b2f2", value: 1, label: "First year" },
      ]),
    },
    lab: { findMany: jest.fn(async () => []) },
    equipmentCategory: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock("../../src/config/redis", () => ({
  redis: {
    eval: jest.fn(async () => [1, 0]),
  },
}));

function accessToken() {
  return jwt.sign({ sub: userId, sid: sessionId, type: "access" }, process.env.JWT_SECRET!, {
    expiresIn: "15m",
  });
}

describe("Reference data API", () => {
  it("requires an authenticated session", async () => {
    const response = await request(createApp()).get("/api/v1/reference-data/departments");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns active onboarding options and applies programme filters", async () => {
    const token = accessToken();
    const departments = await request(createApp())
      .get("/api/v1/reference-data/departments")
      .set("Authorization", `Bearer ${token}`);
    const programmes = await request(createApp())
      .get(`/api/v1/reference-data/programmes?departmentId=${departmentId}`)
      .set("Authorization", `Bearer ${token}`);
    const academicYears = await request(createApp())
      .get("/api/v1/reference-data/academic-years")
      .set("Authorization", `Bearer ${token}`);

    expect(departments.status).toBe(200);
    expect(departments.body.data[0]).toMatchObject({ code: "CSE" });
    expect(programmes.status).toBe(200);
    expect(programmes.body.data[0]).toMatchObject({ departmentId, code: "BTECH-CSE" });
    expect(prisma.programme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ departmentId }) }),
    );
    expect(academicYears.status).toBe(200);
    expect(academicYears.body.data[0]).toMatchObject({ value: 1, label: "First year" });
  });

  it("rejects malformed filters before querying the database", async () => {
    const response = await request(createApp())
      .get("/api/v1/reference-data/programmes?departmentId=not-a-uuid")
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
