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

import request from "supertest";
import { createApp } from "../../src/app.js";

const user = {
  id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
  googleSubject: "google-subject-123",
  name: "Aarav",
  email: "aarav@mitwpu.edu.in",
  roles: ["STUDENT"],
  avatarUrl: null,
  profileComplete: false,
  isActive: true,
  tokenVersion: 0,
  lastLoginAt: new Date("2026-08-16T00:00:00.000Z"),
  createdAt: new Date("2026-08-16T00:00:00.000Z"),
  updatedAt: new Date("2026-08-16T00:00:00.000Z"),
  deletedAt: null,
};

jest.mock("../../src/modules/auth/google-identity", () => ({
  verifyMitWpuCredential: jest.fn(async () => ({
    subject: "google-subject-123",
    email: "aarav@mitwpu.edu.in",
    name: "Aarav",
  })),
}));

jest.mock("../../src/config/db", () => {
  const tx = {
    userProvisioning: { findUnique: jest.fn(async () => null), update: jest.fn() },
    user: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => user),
      update: jest.fn(async () => user),
    },
    projectMember: { findMany: jest.fn(async () => []), updateMany: jest.fn() },
    notification: { createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  return {
    prisma: {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      session: { create: jest.fn() },
    },
  };
});

jest.mock("../../src/config/redis", () => ({
  redis: {
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(async () => 0),
    zadd: jest.fn(),
    expire: jest.fn(),
  },
}));

describe("institutional Google authentication", () => {
  it("issues an application session after CSRF-protected Google sign-in", async () => {
    const agent = request.agent(createApp());
    const csrf = await agent.get("/api/v1/auth/google/csrf");
    const csrfToken = csrf.body.data.csrfToken as string;

    const response = await agent.post("/api/v1/auth/google").send({
      credential: "x".repeat(200),
      csrfToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("aarav@mitwpu.edu.in");
    expect(response.body.data.user.profileComplete).toBe(false);
    expect(response.body.data.next).toBe("onboarding");
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("ums_refresh_token=")]),
    );
  });

  it("rejects sign-in when the login CSRF cookie is absent", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/google")
      .send({
        credential: "x".repeat(200),
        csrfToken: "x".repeat(43),
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("LOGIN_CSRF_MISMATCH");
  });
});
