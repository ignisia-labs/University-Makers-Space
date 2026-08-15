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

import { registerSchema } from "../../src/modules/auth/auth-schema.js";
import { createBookingSchema } from "../../src/modules/bookings/booking-schema.js";

describe("validators", () => {
  it("normalizes email during registration", () => {
    const parsed = registerSchema.parse({
      body: { name: "Aarav", email: " AARAV@MITWPU.EDU.IN ", password: "Password123!" },
    });
    expect(parsed.body.email).toBe("aarav@mitwpu.edu.in");
  });

  it("rejects inverted booking ranges", () => {
    const parsed = createBookingSchema.safeParse({
      body: {
        equipmentId: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        startTime: "2026-08-15T11:00:00.000Z",
        endTime: "2026-08-15T10:00:00.000Z",
      },
    });
    expect(parsed.success).toBe(false);
  });
});
