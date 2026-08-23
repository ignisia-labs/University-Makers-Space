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
  AttendanceStatus,
  BookingCancellationSource,
  BookingStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
} from "@prisma/client";
import * as service from "../../src/modules/bookings/booking-service.js";

const leaderId = "6f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const memberId = "7f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const labId = "8f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const slotId = "9f5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const projectId = "af5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const bookingId = "bf5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const idempotencyKey = "cf5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const cancellationKey = "df5c6a30-8db5-4f06-90f6-1eb4e664b2f2";
const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
const localDate = new Date(`${startsAt.toISOString().slice(0, 10)}T00:00:00.000Z`);

const viewer = {
  id: leaderId,
  name: "Project Leader",
  email: "leader@mitwpu.edu.in",
  roles: [UserRole.STUDENT],
  profileComplete: true,
  isActive: true,
  sessionId: "ef5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
};

const lab = {
  id: labId,
  name: "MIT-WPU MakerSpace",
  isActive: true,
  timeZone: "Asia/Kolkata",
  bookingHorizonDays: 14,
  cancellationWindowHours: 2,
  maxFutureBookingsPerProject: null as number | null,
  projectVerificationRequired: true,
  teamLeaderAttendanceRequired: true,
};
const slot = {
  id: slotId,
  labId,
  localDate,
  startsAt,
  endsAt,
  bookingCapacity: 20,
  status: "OPEN",
  lab,
};
const project = {
  id: projectId,
  labId,
  creatorId: leaderId,
  title: "Autonomous Rover",
  status: ProjectStatus.VERIFIED as ProjectStatus,
  deletedAt: null,
  members: [
    {
      userId: leaderId,
      role: ProjectMemberRole.LEADER,
      status: ProjectMemberStatus.ACCEPTED,
      user: {
        id: leaderId,
        name: "Project Leader",
        email: "leader@mitwpu.edu.in",
        roles: [UserRole.STUDENT],
        isActive: true,
        deletedAt: null,
        studentProfile: { prn: "1032220001" },
      },
    },
    {
      userId: memberId,
      role: ProjectMemberRole.MEMBER,
      status: ProjectMemberStatus.ACCEPTED,
      user: {
        id: memberId,
        name: "Team Member",
        email: "member@mitwpu.edu.in",
        roles: [UserRole.STUDENT],
        isActive: true,
        deletedAt: null,
        studentProfile: { prn: "1032220002" },
      },
    },
  ],
};

type MutableState = {
  existing: ReturnType<typeof bookingRecord> | null;
  current: ReturnType<typeof bookingRecord> | null;
  reserved: number;
  futureBookings: number;
  duplicate: boolean;
};

const state: MutableState = {
  existing: null,
  current: null,
  reserved: 0,
  futureBookings: 0,
  duplicate: false,
};

const tx = {
  $queryRaw: jest.fn(async () => [{ id: slotId }]),
  labSlot: { findUnique: jest.fn(async () => slot) },
  project: { findUnique: jest.fn(async () => project) },
  booking: {
    findUnique: jest.fn(async (args: { where: Record<string, unknown> }) =>
      "id" in args.where ? state.current : state.existing,
    ),
    findFirst: jest.fn(async () => (state.duplicate ? { id: bookingId } : null)),
    count: jest.fn(async () => state.futureBookings),
    aggregate: jest.fn(async () => ({ _sum: { attendeeCount: state.reserved } })),
    create: jest.fn(async (args: { data: Record<string, unknown> }) => {
      const created = bookingRecord(args.data);
      state.current = created;
      state.existing = created;
      return created;
    }),
    update: jest.fn(async (args: { data: Record<string, unknown> }) => {
      const updated = {
        ...state.current!,
        ...args.data,
        updatedAt: new Date(),
      } as ReturnType<typeof bookingRecord>;
      state.current = updated;
      state.existing = updated;
      return updated;
    }),
  },
  notification: {
    createManyAndReturn: jest.fn(async (args: { data: Array<Record<string, unknown>> }) =>
      args.data.map((_row, index) => ({ id: `notification-${index}` })),
    ),
  },
  notificationDelivery: { createMany: jest.fn(async () => ({ count: 2 })) },
  auditLog: { create: jest.fn(async () => undefined) },
};

jest.mock("../../src/config/db", () => ({
  prisma: {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    booking: {
      findUnique: jest.fn(async () => state.existing),
      findFirst: jest.fn(async (args: { where: Record<string, unknown> }) => {
        if ("cancellationIdempotencyKey" in args.where) {
          return state.current?.cancellationIdempotencyKey === args.where.cancellationIdempotencyKey
            ? state.current
            : null;
        }
        return state.duplicate ? { id: bookingId } : null;
      }),
    },
  },
}));

jest.mock("../../src/config/redis", () => ({
  redis: { publish: jest.fn(async () => 1) },
}));

function bookingRecord(data: Record<string, unknown> = {}) {
  const participantCreate =
    (data.participants as { create?: Array<Record<string, unknown>> } | undefined)?.create ?? [];
  return {
    id: bookingId,
    labId,
    labSlotId: slotId,
    projectId,
    createdById: leaderId,
    cancelledById: null,
    idempotencyKey,
    creationRequestFingerprint: String(data.creationRequestFingerprint ?? "a".repeat(64)),
    cancellationIdempotencyKey: null,
    cancellationRequestFingerprint: null,
    attendeeCount: participantCreate.length || 2,
    status: BookingStatus.CONFIRMED,
    notes: null,
    labNameSnapshot: "MIT-WPU MakerSpace",
    projectTitleSnapshot: "Autonomous Rover",
    slotStartsAtSnapshot: startsAt,
    slotEndsAtSnapshot: endsAt,
    timeZoneSnapshot: "Asia/Kolkata",
    cancellationWindowHoursSnapshot: 2,
    cancellationSource: null,
    cancelledByNameSnapshot: null,
    cancelledByRoleSnapshot: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
    participants: participantCreate.length
      ? participantCreate.map((participant) => ({
          bookingId,
          attendanceStatus: AttendanceStatus.EXPECTED,
          ...participant,
        }))
      : [
          {
            bookingId,
            userId: leaderId,
            attendanceStatus: AttendanceStatus.EXPECTED,
            nameSnapshot: "Project Leader",
            emailSnapshot: "leader@mitwpu.edu.in",
            prnSnapshot: "1032220001",
            projectRoleSnapshot: ProjectMemberRole.LEADER,
          },
          {
            bookingId,
            userId: memberId,
            attendanceStatus: AttendanceStatus.EXPECTED,
            nameSnapshot: "Team Member",
            emailSnapshot: "member@mitwpu.edu.in",
            prnSnapshot: "1032220002",
            projectRoleSnapshot: ProjectMemberRole.MEMBER,
          },
        ],
  };
}

describe("Phase 4 booking service", () => {
  beforeEach(() => {
    state.existing = null;
    state.current = null;
    state.reserved = 0;
    state.futureBookings = 0;
    state.duplicate = false;
    lab.maxFutureBookingsPerProject = null;
    lab.projectVerificationRequired = true;
    project.status = ProjectStatus.VERIFIED;
    jest.clearAllMocks();
  });

  it("creates immutable participant history and one batched notification/outbox set", async () => {
    const result = await service.create(viewer, {
      labSlotId: slotId,
      projectId,
      participantIds: [leaderId, memberId],
      idempotencyKey,
      notes: "Rover assembly",
    });

    expect(result.replayed).toBe(false);
    expect(result.booking).toMatchObject({
      id: bookingId,
      projectTitle: "Autonomous Rover",
      labName: "MIT-WPU MakerSpace",
      attendeeCount: 2,
      statusLabel: "Confirmed",
      participants: [
        { userId: leaderId, name: "Project Leader", role: ProjectMemberRole.LEADER },
        { userId: memberId, name: "Team Member", role: ProjectMemberRole.MEMBER },
      ],
    });
    expect(result.booking.participants[0]).toMatchObject({
      userId: leaderId,
      email: "leader@mitwpu.edu.in",
      prn: "1032220001",
    });
    expect(result.booking.participants[1]).not.toHaveProperty("email");
    expect(result.booking.participants[1]).not.toHaveProperty("prn");
    const operationalView = await service.get(bookingId, {
      ...viewer,
      id: "1f5c6a30-8db5-4f06-90f6-1eb4e664b2f2",
      email: "assistant@mitwpu.edu.in",
      roles: [UserRole.LAB_ASSISTANT],
    });
    expect(operationalView.participants[1]).toMatchObject({
      userId: memberId,
      email: "member@mitwpu.edu.in",
      prn: "1032220002",
    });
    const createData = tx.booking.create.mock.calls[0]![0].data;
    expect(createData).not.toHaveProperty("equipment");
    expect(createData).not.toHaveProperty("consumables");
    expect(createData).not.toHaveProperty("qrTokenHash");
    expect(createData).toMatchObject({
      labNameSnapshot: "MIT-WPU MakerSpace",
      projectTitleSnapshot: "Autonomous Rover",
      cancellationWindowHoursSnapshot: 2,
    });
    expect(tx.notification.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(tx.notificationDelivery.createMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "booking.created" }) }),
    );
  });

  it("requires the leader when the configured attendance policy is enabled", async () => {
    await expect(
      service.create(viewer, {
        labSlotId: slotId,
        projectId,
        participantIds: [memberId],
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "TEAM_LEADER_ATTENDANCE_REQUIRED" });
  });

  it("rejects duplicate participants before opening a transaction", async () => {
    await expect(
      service.create(viewer, {
        labSlotId: slotId,
        projectId,
        participantIds: [leaderId, leaderId],
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_PARTICIPANTS" });
    const { prisma } = jest.requireMock("../../src/config/db") as {
      prisma: { $transaction: jest.Mock };
    };
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("enforces the configured future-booking limit for a project", async () => {
    lab.maxFutureBookingsPerProject = 1;
    state.futureBookings = 1;

    await expect(
      service.create(viewer, {
        labSlotId: slotId,
        projectId,
        participantIds: [leaderId],
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "PROJECT_BOOKING_LIMIT_REACHED" });
  });

  it("always requires a verified project even if a legacy policy flag is false", async () => {
    lab.projectVerificationRequired = false;
    project.status = ProjectStatus.MENTOR_APPROVAL_PENDING;

    await expect(
      service.create(viewer, {
        labSlotId: slotId,
        projectId,
        participantIds: [leaderId],
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "PROJECT_NOT_VERIFIED" });
  });

  it("returns actionable remaining capacity when concurrent demand no longer fits", async () => {
    state.reserved = 19;
    await expect(
      service.create(viewer, {
        labSlotId: slotId,
        projectId,
        participantIds: [leaderId, memberId],
        idempotencyKey,
      }),
    ).rejects.toMatchObject({
      code: "SLOT_CAPACITY_EXCEEDED",
      details: [expect.objectContaining({ remainingCapacity: 1, requestedParticipants: 2 })],
    });
  });

  it("rejects reuse of a creation key with a changed payload", async () => {
    const first = await service.create(viewer, {
      labSlotId: slotId,
      projectId,
      participantIds: [leaderId, memberId],
      idempotencyKey,
    });
    expect(first.replayed).toBe(false);

    await expect(
      service.create(viewer, {
        labSlotId: slotId,
        projectId,
        participantIds: [leaderId],
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("cancels with Student source, immutable history, and one notification set", async () => {
    await service.create(viewer, {
      labSlotId: slotId,
      projectId,
      participantIds: [leaderId, memberId],
      idempotencyKey,
    });
    const result = await service.cancel(bookingId, "Team unavailable", cancellationKey, viewer);

    expect(result.replayed).toBe(false);
    expect(result.booking).toMatchObject({
      status: BookingStatus.CANCELLED,
      statusLabel: "Cancelled by Student",
      cancellationSource: BookingCancellationSource.STUDENT,
      cancellationReason: "Team unavailable",
      canCancel: false,
    });
    expect(tx.booking.update.mock.calls[0]![0].data).toMatchObject({
      cancellationSource: BookingCancellationSource.STUDENT,
      cancelledByRoleSnapshot: UserRole.STUDENT,
      cancellationIdempotencyKey: cancellationKey,
      status: BookingStatus.CANCELLED,
    });
    expect(tx.notification.createManyAndReturn).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "booking.cancelled" }) }),
    );
  });

  it("does not replay a cancellation under a different idempotency key", async () => {
    await service.create(viewer, {
      labSlotId: slotId,
      projectId,
      participantIds: [leaderId],
      idempotencyKey,
    });
    await service.cancel(bookingId, "Team unavailable", cancellationKey, viewer);

    await expect(
      service.cancel(bookingId, "Team unavailable", "ff5c6a30-8db5-4f06-90f6-1eb4e664b2f2", viewer),
    ).rejects.toMatchObject({ code: "BOOKING_ALREADY_CANCELLED" });
  });

  it("never allows the generic status endpoint to bypass cancellation history", async () => {
    await expect(
      service.updateStatus(bookingId, BookingStatus.CANCELLED, null, viewer),
    ).rejects.toEqual(expect.objectContaining({ code: "CANCELLATION_ENDPOINT_REQUIRED" }));
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
});
