import crypto from "node:crypto";
import { BookingStatus, Prisma } from "@prisma/client";
import { hasPermission } from "../../config/permissions.js";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { bookingDto } from "../../utils/serializers.js";

const sortFields = new Set(["status", "createdAt", "updatedAt"]);
const capacityStatuses = [BookingStatus.CONFIRMED, BookingStatus.ACTIVE];

type Viewer = NonNullable<Express.Request["user"]>;
type BookingInput = {
  labSlotId: string;
  projectId: string;
  participantIds: string[];
  equipment: { equipmentId: string; quantity: number }[];
  consumables: { consumableId: string; expectedQuantity?: number }[];
  idempotencyKey: string;
  notes?: string | null;
};

export async function list(query: Record<string, unknown>, viewer: Viewer) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const operational = hasPermission(viewer.roles, "booking.read.operational");
  const where: Prisma.BookingWhereInput = {
    ...(operational
      ? query.userId
        ? { participants: { some: { userId: String(query.userId) } } }
        : {}
      : {
          OR: [{ createdById: viewer.id }, { participants: { some: { userId: viewer.id } } }],
        }),
    ...(query.labSlotId ? { labSlotId: String(query.labSlotId) } : {}),
    ...(query.projectId ? { projectId: String(query.projectId) } : {}),
    ...(query.status ? { status: query.status as Prisma.EnumBookingStatusFilter } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: { labSlot: true, participants: true },
      orderBy: { [sortBy]: query.order ?? "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: rows.map(bookingDto), meta: meta(page, limit, total) };
}

export async function get(id: string, viewer: Viewer) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { labSlot: true, participants: true, equipment: true, consumables: true },
  });
  if (!booking) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  const canRead =
    booking.createdById === viewer.id ||
    booking.participants.some((participant) => participant.userId === viewer.id) ||
    hasPermission(viewer.roles, "booking.read.operational");
  if (!canRead) throw new ApiError(403, "FORBIDDEN", "You do not have permission for this booking");
  return bookingDto(booking);
}

export async function create(userId: string, data: BookingInput) {
  const existing = await prisma.booking.findUnique({
    where: {
      createdById_idempotencyKey: { createdById: userId, idempotencyKey: data.idempotencyKey },
    },
    include: { labSlot: true, participants: true },
  });
  if (existing) return { booking: bookingDto(existing), replayed: true };

  const qrToken = crypto.randomBytes(32).toString("base64url");
  const booking = await prisma.$transaction(
    async (tx) => {
      const lockedSlots = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM "lab_slots"
        WHERE id = ${data.labSlotId}::uuid
        FOR UPDATE
      `);
      if (lockedSlots.length !== 1) throw new ApiError(404, "NOT_FOUND", "Lab slot not found");

      const replay = await tx.booking.findUnique({
        where: {
          createdById_idempotencyKey: {
            createdById: userId,
            idempotencyKey: data.idempotencyKey,
          },
        },
        include: { labSlot: true, participants: true },
      });
      if (replay) return { booking: replay, replayed: true as const };

      const slot = await tx.labSlot.findUnique({
        where: { id: data.labSlotId },
        include: { lab: true },
      });
      if (!slot || slot.status !== "OPEN") {
        throw new ApiError(409, "SLOT_UNAVAILABLE", "This slot is not open for booking");
      }
      const now = new Date();
      const horizon = new Date(now.getTime() + slot.lab.bookingHorizonDays * 24 * 60 * 60 * 1000);
      if (slot.startsAt <= now || slot.startsAt > horizon) {
        throw new ApiError(409, "SLOT_OUTSIDE_BOOKING_WINDOW", "This slot cannot be booked now");
      }

      const project = await tx.project.findUnique({
        where: { id: data.projectId },
        include: { members: { where: { status: "ACCEPTED" } } },
      });
      if (!project || project.deletedAt) throw new ApiError(404, "NOT_FOUND", "Project not found");
      if (project.status !== "VERIFIED") {
        throw new ApiError(409, "PROJECT_NOT_VERIFIED", "Only verified projects can book slots");
      }
      if (project.creatorId !== userId) {
        throw new ApiError(403, "TEAM_LEADER_REQUIRED", "Only the project leader can book a slot");
      }
      if (project.labId !== slot.labId) {
        throw new ApiError(400, "LAB_MISMATCH", "Project and slot must belong to the same lab");
      }

      const acceptedIds = new Set(
        project.members.flatMap((member) => (member.userId ? [member.userId] : [])),
      );
      if (data.participantIds.some((participantId) => !acceptedIds.has(participantId))) {
        throw new ApiError(
          400,
          "INVALID_PARTICIPANTS",
          "Every attendee must be an accepted project member",
        );
      }

      const reserved = await tx.booking.aggregate({
        where: { labSlotId: slot.id, status: { in: capacityStatuses } },
        _sum: { attendeeCount: true },
      });
      const placesUsed = reserved._sum.attendeeCount ?? 0;
      if (placesUsed + data.participantIds.length > slot.bookingCapacity) {
        throw new ApiError(409, "SLOT_CAPACITY_EXCEEDED", "Not enough places remain in this slot");
      }

      await validateEquipment(tx, slot.labId, slot.id, data.equipment);
      await validateConsumables(tx, slot.labId, data.consumables);

      const created = await tx.booking.create({
        data: {
          labId: slot.labId,
          labSlotId: slot.id,
          projectId: project.id,
          createdById: userId,
          idempotencyKey: data.idempotencyKey,
          attendeeCount: data.participantIds.length,
          notes: data.notes,
          qrTokenHash: hashToken(qrToken),
          qrExpiresAt: slot.endsAt,
          participants: {
            create: data.participantIds.map((participantId) => ({ userId: participantId })),
          },
          equipment: { create: data.equipment },
          consumables: {
            create: data.consumables.map((item) => ({
              consumableId: item.consumableId,
              expectedQuantity: item.expectedQuantity,
            })),
          },
        },
        include: { labSlot: true, participants: true },
      });
      return { booking: created, replayed: false as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
  if (booking.replayed) return { booking: bookingDto(booking.booking), replayed: true };
  return { booking: bookingDto(booking.booking), qrToken, replayed: false };
}

export async function cancel(id: string, reason: string, viewer: Viewer) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM "bookings" WHERE id = ${id}::uuid FOR UPDATE
      `);
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { labSlot: { include: { lab: true } }, participants: true },
      });
      if (!booking) throw new ApiError(404, "NOT_FOUND", "Booking not found");
      const canManage = hasPermission(viewer.roles, "booking.manage");
      if (booking.createdById !== viewer.id && !canManage) {
        throw new ApiError(403, "FORBIDDEN", "You cannot cancel this booking");
      }
      if (booking.status === BookingStatus.CANCELLED) return bookingDto(booking);
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new ApiError(
          409,
          "INVALID_BOOKING_STATE",
          "Only confirmed bookings can be cancelled",
        );
      }
      const cancellationDeadline = new Date(
        booking.labSlot.startsAt.getTime() -
          booking.labSlot.lab.cancellationWindowHours * 60 * 60 * 1000,
      );
      if (!canManage && new Date() > cancellationDeadline) {
        throw new ApiError(409, "CANCELLATION_WINDOW_CLOSED", "The cancellation window has closed");
      }
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledById: viewer.id,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: { labSlot: true, participants: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: viewer.id,
          action: "booking.cancelled",
          entityType: "Booking",
          entityId: id,
          metadata: { reason },
        },
      });
      return bookingDto(updated);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateStatus(
  id: string,
  status: BookingStatus,
  notes: string | null | undefined,
  actorId: string,
) {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    CONFIRMED: [BookingStatus.ACTIVE, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
    ACTIVE: [BookingStatus.COMPLETED],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM "bookings" WHERE id = ${id}::uuid FOR UPDATE
      `);
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Booking not found");
      if (!allowed[existing.status].includes(status)) {
        throw new ApiError(
          409,
          "INVALID_BOOKING_STATE",
          "This booking status transition is not allowed",
        );
      }
      const updated = await tx.booking.update({
        where: { id },
        data: { status, notes },
        include: { labSlot: true, participants: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "booking.status_changed",
          entityType: "Booking",
          entityId: id,
          metadata: { from: existing.status, to: status },
        },
      });
      return bookingDto(updated);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function validateEquipment(
  tx: Prisma.TransactionClient,
  labId: string,
  labSlotId: string,
  requested: BookingInput["equipment"],
) {
  if (new Set(requested.map((item) => item.equipmentId)).size !== requested.length) {
    throw new ApiError(400, "DUPLICATE_EQUIPMENT", "Equipment requests must be unique");
  }
  for (const item of requested) {
    const equipment = await tx.equipment.findFirst({
      where: { id: item.equipmentId, labId, visible: true, deletedAt: null },
    });
    if (
      !equipment ||
      ["UNAVAILABLE", "UNDER_MAINTENANCE", "DAMAGED", "OUT_OF_SERVICE"].includes(equipment.status)
    ) {
      throw new ApiError(409, "EQUIPMENT_UNAVAILABLE", "Requested equipment is unavailable");
    }
    const reserved = await tx.bookingEquipment.aggregate({
      where: {
        equipmentId: item.equipmentId,
        booking: { labSlotId, status: { in: capacityStatuses } },
      },
      _sum: { quantity: true },
    });
    if ((reserved._sum.quantity ?? 0) + item.quantity > equipment.availableQuantity) {
      throw new ApiError(409, "EQUIPMENT_CAPACITY_EXCEEDED", `${equipment.name} is fully reserved`);
    }
  }
}

async function validateConsumables(
  tx: Prisma.TransactionClient,
  labId: string,
  requested: BookingInput["consumables"],
) {
  if (new Set(requested.map((item) => item.consumableId)).size !== requested.length) {
    throw new ApiError(400, "DUPLICATE_CONSUMABLE", "Consumable requests must be unique");
  }
  if (!requested.length) return;
  const count = await tx.consumable.count({
    where: { id: { in: requested.map((item) => item.consumableId) }, labId, isActive: true },
  });
  if (count !== requested.length) {
    throw new ApiError(
      400,
      "INVALID_CONSUMABLE",
      "A requested consumable is not available in this lab",
    );
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
