process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ums_test?schema=public";
process.env.JWT_SECRET = "12345678901234567890123456789012";
process.env.JWT_REFRESH_SECRET = "12345678901234567890123456789012";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.CLOUDINARY_CLOUD_NAME = "test";
process.env.CLOUDINARY_API_KEY = "test";
process.env.CLOUDINARY_API_SECRET = "test";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.BCRYPT_ROUNDS = "12";

import request from "supertest";
import { createApp } from "../../src/app.js";

jest.mock("../../src/config/db", () => ({
  prisma: {
    user: {
      create: jest.fn(async () => ({
        id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        name: "Aarav",
        email: "aarav@mitwpu.edu.in",
        roles: ["student"],
        avatarUrl: null,
        isActive: true,
        tokenVersion: 0,
        createdAt: new Date("2026-08-15T00:00:00.000Z"),
        updatedAt: new Date("2026-08-15T00:00:00.000Z"),
      })),
    },
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

describe("auth routes", () => {
  it("wraps register responses in the standard envelope", async () => {
    const res = await request(createApp()).post("/api/v1/auth/register").send({
      name: "Aarav",
      email: "aarav@mitwpu.edu.in",
      password: "Password123!",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.passwordHash).toBeUndefined();
  });
});
