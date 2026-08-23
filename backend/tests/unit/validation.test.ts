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

import { EquipmentStatus, MentorRequestStatus, ProjectStatus, UserRole } from "@prisma/client";
import { hasPermission, permissions } from "../../src/config/permissions.js";
import { onboardingSchema } from "../../src/modules/auth/auth-schema.js";
import {
  cancelBookingSchema,
  createBookingSchema,
  listBookingsSchema,
  updateBookingStatusSchema,
} from "../../src/modules/bookings/booking-schema.js";
import { updateEquipmentAvailabilitySchema } from "../../src/modules/equipment/equipment-schema.js";
import {
  updateLabConfigurationSchema,
  upsertLabDateExceptionSchema,
} from "../../src/modules/labs/lab-schema.js";
import {
  createProjectSchema,
  invitationDecisionSchema,
  mentorDecisionSchema,
  updateProjectSchema,
} from "../../src/modules/projects/project-schema.js";
import { deriveProjectStatus } from "../../src/modules/projects/project-service.js";
import { normalizePrn } from "../../src/modules/users/prn-policy.js";
import {
  studentDirectorySearchSchema,
  updateOwnStudentProfileSchema,
} from "../../src/modules/users/user-schema.js";

describe("validators", () => {
  it("rejects a PRN that does not satisfy the configured institutional policy", () => {
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

  it("normalizes a valid PRN before persistence", () => {
    expect(normalizePrn(" mit-12ab34 ")).toBe("MIT-12AB34");
  });

  it("requires the complete atomic project submission payload", () => {
    const parsed = createProjectSchema.safeParse({
      body: {
        idempotencyKey: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        labId: "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        title: "Solar tracker",
        description: "A two-axis solar tracking prototype.",
        teamMemberEmails: ["teammate@mitwpu.edu.in"],
        mentorId: "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        equipmentIds: [],
        consumableIds: [],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts only explicit invitation decisions", () => {
    expect(
      invitationDecisionSchema.safeParse({
        params: { id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" },
        body: { decision: "ACCEPTED" },
      }).success,
    ).toBe(true);
    expect(
      invitationDecisionSchema.safeParse({
        params: { id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" },
        body: { decision: "MAYBE" },
      }).success,
    ).toBe(false);
  });

  it("enforces bounded directory search and rejects one-character enumeration", () => {
    expect(
      studentDirectorySearchSchema.safeParse({
        query: { search: "aa", page: "1", limit: "20" },
      }).success,
    ).toBe(true);
    expect(studentDirectorySearchSchema.safeParse({ query: { search: "a" } }).success).toBe(false);
    expect(
      studentDirectorySearchSchema.safeParse({
        query: { search: "student", limit: "101" },
      }).success,
    ).toBe(false);
  });

  it("normalizes PRN during permitted Student profile edits", () => {
    const parsed = updateOwnStudentProfileSchema.parse({
      body: {
        fullName: "Aarav Deshmukh",
        prn: " mit-12ab34 ",
        departmentId: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        programmeId: "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        academicYear: 3,
      },
    });
    expect(parsed.body.prn).toBe("MIT-12AB34");
  });

  it("requires feedback when a Faculty Mentor rejects a project", () => {
    const params = { id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" };
    expect(mentorDecisionSchema.safeParse({ params, body: { decision: "REJECTED" } }).success).toBe(
      false,
    );
    expect(
      mentorDecisionSchema.safeParse({
        params,
        body: { decision: "REJECTED", reason: "Clarify the safety plan." },
      }).success,
    ).toBe(true);
  });

  it("rejects empty project edits", () => {
    expect(
      updateProjectSchema.safeParse({
        params: { id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" },
        body: {},
      }).success,
    ).toBe(false);
  });

  it("verifies a project only when team and mentor conditions are both satisfied", () => {
    expect(deriveProjectStatus(1, MentorRequestStatus.APPROVED)).toBe(
      ProjectStatus.TEAM_ACCEPTANCE_PENDING,
    );
    expect(deriveProjectStatus(0, MentorRequestStatus.PENDING)).toBe(
      ProjectStatus.MENTOR_APPROVAL_PENDING,
    );
    expect(deriveProjectStatus(0, MentorRequestStatus.APPROVED)).toBe(ProjectStatus.VERIFIED);
    expect(deriveProjectStatus(0, MentorRequestStatus.REJECTED)).toBe(ProjectStatus.REJECTED);
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

  it("keeps the Phase 4 booking payload capacity-only", () => {
    const base = {
      labSlotId: "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
      projectId: "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
      participantIds: ["6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2"],
      idempotencyKey: "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
    };
    expect(createBookingSchema.safeParse({ body: base }).success).toBe(true);
    expect(
      createBookingSchema.safeParse({
        body: { ...base, equipment: [{ equipmentId: base.labSlotId, quantity: 1 }] },
      }).success,
    ).toBe(false);
  });

  it("requires cancellation idempotency and reserves CANCELLED for the cancel endpoint", () => {
    const params = { id: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" };
    expect(
      cancelBookingSchema.safeParse({ params, body: { reason: "Team unavailable" } }).success,
    ).toBe(false);
    expect(
      cancelBookingSchema.safeParse({
        params,
        body: {
          reason: "Team unavailable",
          idempotencyKey: "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
        },
      }).success,
    ).toBe(true);
    expect(
      updateBookingStatusSchema.safeParse({
        params,
        body: { status: "CANCELLED", notes: "Bypass" },
      }).success,
    ).toBe(false);
  });

  it("rejects booking list query keys the service does not implement", () => {
    expect(listBookingsSchema.safeParse({ query: { scope: "upcoming", page: "1" } }).success).toBe(
      true,
    );
    expect(listBookingsSchema.safeParse({ query: { search: "rover" } }).success).toBe(false);
    expect(listBookingsSchema.safeParse({ query: { sortBy: "createdAt" } }).success).toBe(false);
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

  it("requires one valid schedule row for every day of the week", () => {
    const body = {
      configurationVersion: 1,
      name: "MIT-WPU MakerSpace",
      description: "University prototyping facility",
      timeZone: "Asia/Kolkata",
      slotDurationMinutes: 60,
      bookingCapacity: 20,
      quickVisitsEnabled: true,
      quickVisitCapacity: 10,
      bookingHorizonDays: 14,
      cancellationWindowHours: 2,
      maxFutureBookingsPerProject: null,
      projectVerificationRequired: true,
      teamLeaderAttendanceRequired: true,
      weeklySchedule: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        isOpen: true,
        opensAt: "08:30",
        closesAt: "18:30",
      })),
    };
    const params = { labId: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" };
    expect(updateLabConfigurationSchema.safeParse({ params, body }).success).toBe(true);
    expect(
      updateLabConfigurationSchema.safeParse({
        params,
        body: {
          ...body,
          weeklySchedule: body.weeklySchedule.map((row) => ({ ...row, dayOfWeek: 1 })),
        },
      }).success,
    ).toBe(false);
  });

  it("validates closures and special operating hours as different date exceptions", () => {
    const params = { labId: "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2" };
    expect(
      upsertLabDateExceptionSchema.safeParse({
        params,
        body: {
          date: "2026-08-30",
          isClosed: true,
          opensAt: null,
          closesAt: null,
          reason: "University holiday",
        },
      }).success,
    ).toBe(true);
    expect(
      upsertLabDateExceptionSchema.safeParse({
        params,
        body: {
          date: "2026-08-30",
          isClosed: false,
          opensAt: "14:00",
          closesAt: "10:00",
          reason: "Special hours",
        },
      }).success,
    ).toBe(false);
  });

  it("keeps the five-role permission model deny-by-default", () => {
    expect(hasPermission([UserRole.STUDENT], "user.read")).toBe(false);
    expect(hasPermission([UserRole.FACULTY_MENTOR], "project.approve")).toBe(true);
    expect(hasPermission([UserRole.FACULTY_MENTOR], "project.manage.any")).toBe(false);
    expect(hasPermission([UserRole.LAB_ASSISTANT], "booking.manage")).toBe(true);
    expect(hasPermission([UserRole.ADMIN], "user.manage")).toBe(true);
    expect(hasPermission([UserRole.ADMIN], "user.roles.manage")).toBe(false);
    expect(
      permissions.every((permission) => hasPermission([UserRole.SUPER_ADMIN], permission)),
    ).toBe(true);
  });
});
