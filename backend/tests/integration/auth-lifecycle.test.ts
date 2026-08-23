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

import crypto from "node:crypto";
import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app.js";

const userId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const sessionId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const departmentId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const programmeId = "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";

const mockUser = {
  id: userId,
  googleSubject: "google-subject",
  name: "Aarav Deshmukh",
  email: "aarav@mitwpu.edu.in",
  roles: [UserRole.STUDENT],
  avatarUrl: null,
  profileComplete: true,
  isActive: true,
  tokenVersion: 0,
  lastLoginAt: new Date("2026-08-23T08:00:00.000Z"),
  createdAt: new Date("2026-08-23T08:00:00.000Z"),
  updatedAt: new Date("2026-08-23T08:00:00.000Z"),
  deletedAt: null,
};

const mockStudentProfile = {
  userId,
  prn: "MIT12AB34",
  departmentId,
  programmeId,
  academicYear: 2,
  division: null,
  phone: null,
  createdAt: new Date("2026-08-23T08:00:00.000Z"),
  updatedAt: new Date("2026-08-23T08:00:00.000Z"),
};

jest.mock("../../src/config/db", () => {
  const mocks = {
    sessionFindFirst: jest.fn(),
    sessionFindUnique: jest.fn(),
    sessionUpdateMany: jest.fn(),
    userFindUniqueOrThrow: jest.fn(),
    userFindUnique: jest.fn(),
    programmeFindFirst: jest.fn(),
    academicYearFindFirst: jest.fn(),
    studentProfileUpsert: jest.fn(),
    userUpdate: jest.fn(),
    auditCreate: jest.fn(),
  };
  const transactionClient = {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    programme: { findFirst: mocks.programmeFindFirst },
    academicYearOption: { findFirst: mocks.academicYearFindFirst },
    studentProfile: { upsert: mocks.studentProfileUpsert },
    auditLog: { create: mocks.auditCreate },
  };
  return {
    prisma: {
      $transaction: jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient),
      ),
      session: {
        findFirst: mocks.sessionFindFirst,
        findUnique: mocks.sessionFindUnique,
        updateMany: mocks.sessionUpdateMany,
      },
      user: { findUniqueOrThrow: mocks.userFindUniqueOrThrow },
      __authLifecycleMocks: mocks,
    },
  };
});

jest.mock("../../src/config/redis", () => ({
  redis: {
    eval: jest.fn(async () => [1, 0]),
  },
}));

type AuthLifecycleMocks = Record<
  | "sessionFindFirst"
  | "sessionFindUnique"
  | "sessionUpdateMany"
  | "userFindUniqueOrThrow"
  | "userFindUnique"
  | "programmeFindFirst"
  | "academicYearFindFirst"
  | "studentProfileUpsert"
  | "userUpdate"
  | "auditCreate",
  jest.Mock
>;

function dbMocks() {
  return (
    jest.requireMock("../../src/config/db") as {
      prisma: { __authLifecycleMocks: AuthLifecycleMocks };
    }
  ).prisma.__authLifecycleMocks;
}

function accessToken(roles: UserRole[] = [UserRole.STUDENT]) {
  dbMocks().sessionFindFirst.mockResolvedValue({
    id: sessionId,
    user: { ...mockUser, roles },
  });
  return jwt.sign({ sub: userId, sid: sessionId, type: "access" }, process.env.JWT_SECRET!, {
    expiresIn: "15m",
  });
}

describe("Phase 1 authenticated lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbMocks().sessionUpdateMany.mockResolvedValue({ count: 1 });
    dbMocks().userFindUniqueOrThrow.mockResolvedValue({
      ...mockUser,
      studentProfile: {
        ...mockStudentProfile,
        department: { id: departmentId, code: "CSE", name: "Computer Science" },
        programme: {
          id: programmeId,
          departmentId,
          code: "BTECH-CSE",
          name: "B.Tech CSE",
        },
      },
    });
  });

  it("returns persisted identity and effective permissions from /auth/me", async () => {
    const response = await request(createApp())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      email: "aarav@mitwpu.edu.in",
      profileComplete: true,
      studentProfile: {
        prn: "MIT12AB34",
        department: { code: "CSE" },
        programme: { code: "BTECH-CSE" },
      },
    });
    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining(["profile.complete", "project.read.own"]),
    );
  });

  it("revokes the current session and expires the refresh cookie on logout", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken()}`);

    expect(response.status).toBe(204);
    expect(dbMocks().sessionUpdateMany).toHaveBeenCalledWith({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ums_refresh_token=; Path=/api/v1/auth/refresh"),
      ]),
    );
  });

  it("rotates a valid refresh token and returns a new access token", async () => {
    const refreshToken = jwt.sign(
      { sub: userId, sid: sessionId, type: "refresh" },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d", jwtid: "rotation-test" },
    );
    dbMocks().sessionFindUnique.mockResolvedValue({
      id: sessionId,
      userId,
      refreshTokenHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: mockUser,
    });

    const response = await request(createApp())
      .post("/api/v1/auth/refresh")
      .set("Cookie", `ums_refresh_token=${refreshToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(dbMocks().sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: sessionId }) }),
    );
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("ums_refresh_token=")]),
    );
  });

  it("persists a valid student profile and marks onboarding complete", async () => {
    dbMocks().userFindUnique.mockResolvedValue({ ...mockUser, profileComplete: false });
    dbMocks().programmeFindFirst.mockResolvedValue({ id: programmeId, departmentId });
    dbMocks().academicYearFindFirst.mockResolvedValue({ value: 2 });
    dbMocks().studentProfileUpsert.mockResolvedValue(mockStudentProfile);
    dbMocks().userUpdate.mockResolvedValue({ ...mockUser, profileComplete: true });
    dbMocks().auditCreate.mockResolvedValue({ id: "audit" });

    const response = await request(createApp())
      .post("/api/v1/auth/onboarding")
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({
        fullName: "Aarav Deshmukh",
        prn: " mit12ab34 ",
        departmentId,
        programmeId,
        academicYear: 2,
      });

    expect(response.status).toBe(201);
    expect(dbMocks().studentProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ prn: "MIT12AB34", departmentId, programmeId }),
      }),
    );
    expect(dbMocks().userUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "Aarav Deshmukh", profileComplete: true },
    });
  });

  it("denies student onboarding to a pre-provisioned privileged role", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/onboarding")
      .set("Authorization", `Bearer ${accessToken([UserRole.FACULTY_MENTOR])}`)
      .send({
        fullName: "Dr Faculty",
        prn: "MIT12AB34",
        departmentId,
        programmeId,
        academicYear: 2,
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(dbMocks().studentProfileUpsert).not.toHaveBeenCalled();
  });
});
