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

import { EquipmentStatus, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app.js";

const equipmentId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const userId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const sessionId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const now = new Date("2026-08-16T00:00:00.000Z");
const equipment = {
  id: equipmentId,
  labId: "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
  categoryId: "af5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
  name: "Laser cutter",
  description: "CO2 laser cutter",
  status: EquipmentStatus.AVAILABLE,
  imageUrl: null,
  totalQuantity: 2,
  availableQuantity: 2,
  specs: [],
  visible: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

jest.mock("../../src/config/db", () => {
  const tx = {
    $queryRaw: jest.fn(async () => [{ id: equipmentId }]),
    equipment: {
      findUnique: jest.fn(async () => equipment),
      update: jest.fn(async () => ({
        ...equipment,
        status: EquipmentStatus.UNDER_MAINTENANCE,
        availableQuantity: 1,
        category: {
          id: equipment.categoryId,
          labId: equipment.labId,
          name: "Fabrication",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      })),
    },
    auditLog: { create: jest.fn(async () => undefined) },
  };
  return {
    prisma: {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      session: {
        findFirst: jest.fn(async () => ({
          id: sessionId,
          user: {
            id: userId,
            email: "lab.assistant@mitwpu.edu.in",
            roles: [UserRole.LAB_ASSISTANT],
            profileComplete: true,
            isActive: true,
            deletedAt: null,
          },
        })),
      },
    },
  };
});

jest.mock("../../src/config/redis", () => ({
  redis: {
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(async () => 0),
    zadd: jest.fn(),
    expire: jest.fn(),
    scanStream: jest.fn(() => ({
      async *[Symbol.asyncIterator]() {
        yield [];
      },
    })),
    del: jest.fn(),
  },
}));

describe("Lab Assistant equipment availability", () => {
  it("allows the operational permission to use the dedicated audited endpoint", async () => {
    const token = jwt.sign(
      { sub: userId, sid: sessionId, type: "access" },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );

    const response = await request(createApp())
      .patch(`/api/v1/equipment/${equipmentId}/availability`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: EquipmentStatus.UNDER_MAINTENANCE,
        availableQuantity: 1,
        reason: "Preventive maintenance",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: equipmentId,
      status: EquipmentStatus.UNDER_MAINTENANCE,
      availableQuantity: 1,
    });
  });
});
