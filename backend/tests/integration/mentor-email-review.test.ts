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

jest.mock("../../src/config/db", () => ({ prisma: {} }));
jest.mock("../../src/config/redis", () => ({
  redis: {
    eval: jest.fn(async () => [1, 0]),
  },
}));

describe("Faculty Mentor email review", () => {
  it("rejects an invalid action token without requiring application authentication", async () => {
    const response = await request(createApp())
      .post("/api/v1/projects/mentor-requests/6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2/email-review")
      .send({ token: "a".repeat(41) });

    expect(response.status).toBe(410);
    expect(response.body.error.code).toBe("MENTOR_ACTION_LINK_INVALID");
  });
});
