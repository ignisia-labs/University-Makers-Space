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

import { BookingStatus, ProjectMemberRole, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app.js";

const userId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const sessionId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const labId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const slotId = "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const projectId = "af5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const bookingId = "bf5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const idempotencyKey = "cf5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const cancellationKey = "df5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const endsAt = new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString();

const booking = {
  id: bookingId,
  labId,
  labSlotId: slotId,
  projectId,
  createdById: userId,
  projectTitle: "Autonomous Rover",
  labName: "MIT-WPU MakerSpace",
  timeZone: "Asia/Kolkata",
  attendeeCount: 1,
  status: BookingStatus.CONFIRMED,
  statusLabel: "Confirmed",
  notes: null,
  cancellationReason: null,
  cancellationSource: null,
  cancelledAt: null,
  startsAt,
  endsAt,
  participants: [
    {
      userId,
      name: "Project Leader",
      email: "leader@mitwpu.edu.in",
      prn: "1032220001",
      role: ProjectMemberRole.LEADER,
    },
  ],
  canCancel: true,
  cancellationDeadline: startsAt,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCreate = jest.fn(async (..._args: unknown[]) => ({ booking, replayed: false }));
const mockCancel = jest.fn(async (..._args: unknown[]) => ({
  booking: {
    ...booking,
    status: BookingStatus.CANCELLED,
    statusLabel: "Cancelled by Student",
    canCancel: false,
  },
  replayed: false,
}));
const mockList = jest.fn(async (..._args: unknown[]) => ({
  data: [booking],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
}));
const mockGet = jest.fn(async (..._args: unknown[]) => booking);
const mockUpdateStatus = jest.fn(async (..._args: unknown[]) => booking);
let mockRole: UserRole = UserRole.STUDENT;

jest.mock("../../src/modules/bookings/booking-service", () => ({
  create: (...args: unknown[]) => mockCreate(...args),
  cancel: (...args: unknown[]) => mockCancel(...args),
  list: (...args: unknown[]) => mockList(...args),
  get: (...args: unknown[]) => mockGet(...args),
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
}));

jest.mock("../../src/config/db", () => ({
  prisma: {
    session: {
      findFirst: jest.fn(async () => ({
        id: sessionId,
        user: {
          id: userId,
          name: "Project Leader",
          email: "leader@mitwpu.edu.in",
          roles: [mockRole],
          profileComplete: true,
          isActive: true,
          deletedAt: null,
        },
      })),
    },
  },
}));

jest.mock("../../src/config/redis", () => ({
  redis: {
    eval: jest.fn(async () => [1, 0]),
    publish: jest.fn(async () => 1),
  },
}));

function accessToken() {
  return jwt.sign({ sub: userId, sid: sessionId, type: "access" }, process.env.JWT_SECRET!, {
    expiresIn: "15m",
  });
}

describe("Phase 4 booking API contract", () => {
  beforeEach(() => {
    mockRole = UserRole.STUDENT;
    jest.clearAllMocks();
  });

  it("accepts only the Version 1 capacity-booking payload and returns the mutation envelope", async () => {
    const response = await request(createApp())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({
        labSlotId: slotId,
        projectId,
        participantIds: [userId],
        idempotencyKey,
        notes: "Assembly",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      replayed: false,
      booking: { id: bookingId, statusLabel: "Confirmed" },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: userId }),
      expect.objectContaining({ participantIds: [userId] }),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
    const { redis } = jest.requireMock("../../src/config/redis") as {
      redis: { eval: jest.Mock };
    };
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("ZREMRANGEBYSCORE"),
      1,
      expect.stringContaining(`booking-mutation:${userId}`),
      expect.any(Number),
      expect.any(Number),
      30,
      60,
      expect.any(String),
    );
  });

  it("returns 429 from the atomic per-user booking limiter", async () => {
    const { redis } = jest.requireMock("../../src/config/redis") as {
      redis: { eval: jest.Mock };
    };
    redis.eval.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, Date.now()]);

    const response = await request(createApp())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({
        labSlotId: slotId,
        projectId,
        participantIds: [userId],
        idempotencyKey,
      });

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects Future Scope resource allocation fields", async () => {
    const response = await request(createApp())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({
        labSlotId: slotId,
        projectId,
        participantIds: [userId],
        idempotencyKey,
        equipment: [{ equipmentId: labId, quantity: 1 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires a cancellation idempotency key and returns a direct Booking DTO", async () => {
    const missingKey = await request(createApp())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({ reason: "Team unavailable" });
    expect(missingKey.status).toBe(400);

    const response = await request(createApp())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({ reason: "Team unavailable", idempotencyKey: cancellationKey });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: bookingId,
      status: BookingStatus.CANCELLED,
      statusLabel: "Cancelled by Student",
    });
    expect(response.body.data).not.toHaveProperty("booking");
  });

  it("validates temporal list scope and forwards valid pagination to the service", async () => {
    const invalid = await request(createApp())
      .get("/api/v1/bookings?scope=tomorrow")
      .set("Authorization", `Bearer ${accessToken()}`);
    expect(invalid.status).toBe(400);

    const response = await request(createApp())
      .get("/api/v1/bookings?scope=upcoming&page=1&limit=10")
      .set("Authorization", `Bearer ${accessToken()}`);
    expect(response.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "upcoming", page: 1, limit: 10 }),
      expect.objectContaining({ id: userId }),
    );
  });

  it("does not allow generic status mutation to perform cancellation", async () => {
    mockRole = UserRole.LAB_ASSISTANT;
    const response = await request(createApp())
      .patch(`/api/v1/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({ status: BookingStatus.CANCELLED, notes: "Bypass" });
    expect(response.status).toBe(400);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });
});
