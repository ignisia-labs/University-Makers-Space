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
import { hasPermission } from "../../src/config/permissions.js";
import { onboardingSchema } from "../../src/modules/auth/auth-schema.js";
import { createBookingSchema } from "../../src/modules/bookings/booking-schema.js";
import { updateEquipmentAvailabilitySchema } from "../../src/modules/equipment/equipment-schema.js";

describe("validators", () => {
  it("rejects a non-10-digit PRN", () => {
    const parsed = onboardingSchema.safeParse({
      body: {
        fullName: "Aarav Deshmukh",
        prn: "12345",
        departmentId: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        programmeId: "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        academicYear: 3,
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate booking participants", () => {
    const participantId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
    const parsed = createBookingSchema.safeParse({
      body: {
        labSlotId: "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        projectId: "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        participantIds: [participantId, participantId],
        idempotencyKey: "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("requires an operational reason when equipment availability changes", () => {
    const parsed = updateEquipmentAvailabilitySchema.safeParse({
      params: { id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" },
      body: { status: EquipmentStatus.UNDER_MAINTENANCE },
    });
    expect(parsed.success).toBe(false);
  });

  it("allows Lab Assistants to change availability without catalogue-management access", () => {
    expect(hasPermission([UserRole.LAB_ASSISTANT], "equipment.availability.manage")).toBe(true);
    expect(hasPermission([UserRole.LAB_ASSISTANT], "equipment.manage")).toBe(false);
  });
});
