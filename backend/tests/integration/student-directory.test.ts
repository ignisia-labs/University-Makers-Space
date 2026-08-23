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
process.env.FRONTEND_URL = "http://localhost:5174";

import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";

const viewerId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const studentId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const sessionId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";

jest.mock("../../src/config/db", () => ({
  prisma: {
    session: {
      findFirst: jest.fn(async () => ({
        id: sessionId,
        user: {
          id: viewerId,
          name: "Aarav Deshmukh",
          email: "aarav@mitwpu.edu.in",
          roles: [UserRole.STUDENT],
          profileComplete: true,
          isActive: true,
          deletedAt: null,
        },
      })),
    },
    user: {
      count: jest.fn(async () => 1),
      findMany: jest.fn(async () => [
        {
          id: studentId,
          name: "Diya Shah",
          email: "diya@mitwpu.edu.in",
          studentProfile: {
            prn: "MIT-12AB35",
            department: {
              id: "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
              code: "CSE",
              name: "CSE",
            },
          },
        },
      ]),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));

jest.mock("../../src/config/redis", () => ({
  redis: {
    eval: jest.fn(async () => [1, 0]),
  },
}));

function accessToken() {
  return jwt.sign({ sub: viewerId, sid: sessionId, type: "access" }, process.env.JWT_SECRET!, {
    expiresIn: "15m",
  });
}

describe("Phase 2 Student directory API", () => {
  it("rejects unauthenticated access", async () => {
    const response = await request(createApp()).get("/api/v1/users/search/students?search=Diya");
    expect(response.status).toBe(401);
  });

  it("rejects enumeration below the minimum search length before querying", async () => {
    const response = await request(createApp())
      .get("/api/v1/users/search/students?search=D")
      .set("Authorization", `Bearer ${accessToken()}`);
    expect(response.status).toBe(400);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("returns only bounded identification fields with pagination metadata", async () => {
    const response = await request(createApp())
      .get("/api/v1/users/search/students?search=MIT-12&page=1&limit=10")
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: studentId,
        name: "Diya Shah",
        email: "diya@mitwpu.edu.in",
        prn: "MIT-12AB35",
        department: {
          id: "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
          code: "CSE",
          name: "CSE",
        },
      },
    ]);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({
          id: { not: viewerId },
          profileComplete: true,
          roles: { has: UserRole.STUDENT },
        }),
      }),
    );
  });
});
