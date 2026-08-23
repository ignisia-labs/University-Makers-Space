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

import {
  BookingStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
} from "@prisma/client";
import * as service from "../../src/modules/projects/project-service.js";

const leaderId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const labId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const projectId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const bookingId = "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const startsAt = new Date("2026-08-30T03:00:00.000Z");
const endsAt = new Date("2026-08-30T04:00:00.000Z");
const now = new Date("2026-08-23T12:00:00.000Z");

const project = {
  id: projectId,
  labId,
  title: "Autonomous Rover",
  description: "A verified rover prototype",
  creatorId: leaderId,
  currentMentorId: null,
  status: ProjectStatus.VERIFIED,
  domain: null,
  tags: [],
  rejectionReason: null,
  submittedAt: now,
  createdAt: now,
  updatedAt: now,
  creator: { id: leaderId, name: "Project Leader", email: "leader@mitwpu.edu.in" },
  currentMentor: null,
  members: [
    {
      id: "af5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
      userId: leaderId,
      email: "leader@mitwpu.edu.in",
      role: ProjectMemberRole.LEADER,
      status: ProjectMemberStatus.ACCEPTED,
      invitationExpiresAt: null,
      invitationEmailStatus: null,
      respondedAt: now,
      createdAt: now,
      user: {
        id: leaderId,
        name: "Project Leader",
        email: "leader@mitwpu.edu.in",
        studentProfile: { department: { id: labId, code: "CSE", name: "Engineering" } },
      },
    },
  ],
  mentorRequests: [],
  equipmentRequirements: [],
  consumableRequirements: [],
  bookings: [
    {
      id: bookingId,
      status: BookingStatus.CONFIRMED,
      slotStartsAtSnapshot: startsAt,
      slotEndsAtSnapshot: endsAt,
      createdAt: now,
    },
  ],
};

const projectFindFirst = jest.fn(async (..._args: unknown[]) => project);

jest.mock("../../src/config/db", () => ({
  prisma: { project: { findFirst: (...args: unknown[]) => projectFindFirst(...args) } },
}));

const viewer = {
  id: leaderId,
  name: "Project Leader",
  email: "leader@mitwpu.edu.in",
  roles: [UserRole.STUDENT],
  profileComplete: true,
  isActive: true,
  sessionId: "bf5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
};

describe("project booking projection", () => {
  it("bounds embedded history and renders immutable booking-time snapshots", async () => {
    const result = await service.get(projectId, viewer);

    expect(projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          bookings: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 20,
          },
        }),
      }),
    );
    expect(result.bookings).toEqual([
      {
        id: bookingId,
        status: BookingStatus.CONFIRMED,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    ]);
  });
});
