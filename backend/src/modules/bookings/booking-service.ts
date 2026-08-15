import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { bookingDto } from "../../utils/serializers.js";
import { meta } from "../../utils/pagination.js";

const sortFields = new Set(["startTime", "endTime", "status", "createdAt"]);

export async function list(query: Record<string, unknown>, viewer: Express.Request["user"]) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "startTime";
  const isElevated = viewer?.roles.some((r) => ["admin", "staff"].includes(r));
  const where: Prisma.BookingWhereInput = {
    deletedAt: null,
    ...(isElevated ? {} : { userId: viewer!.id }),
    ...(query.userId && isElevated ? { userId: String(query.userId) } : {}),
    ...(query.equipmentId ? { equipmentId: String(query.equipmentId) } : {}),
    ...(query.status ? { status: query.status as Prisma.EnumBookingStatusFilter } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: { [sortBy]: query.order ?? "asc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data: rows.map(bookingDto), meta: meta(page, limit, total) };
}

export async function get(id: string, viewer: Express.Request["user"]) {
  const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null } });
  if (!booking) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  if (booking.userId !== viewer?.id && !viewer?.roles.some((r) => ["admin", "staff"].includes(r))) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this booking");
  }
  return bookingDto(booking);
}

export async function create(userId: string, data: { equipmentId: string; startTime: string; endTime: string; notes?: string | null }) {
  const booking = await prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.findFirst({ where: { id: data.equipmentId, deletedAt: null } });
    if (!equipment) throw new ApiError(404, "NOT_FOUND", "Equipment not found");
    if (equipment.availableQuantity < 1) throw new ApiError(409, "EQUIPMENT_UNAVAILABLE", "Equipment is unavailable");
    await tx.equipment.update({ where: { id: equipment.id }, data: { availableQuantity: { decrement: 1 }, status: "reserved" } });
    return tx.booking.create({
      data: { userId, equipmentId: data.equipmentId, startTime: new Date(data.startTime), endTime: new Date(data.endTime), notes: data.notes },
    });
  });
  return bookingDto(booking);
}

export async function updateStatus(id: string, status: Prisma.BookingUpdateInput["status"], notes?: string | null) {
  const existing = await prisma.booking.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  const updated = await prisma.$transaction(async (tx) => {
    if (["cancelled", "rejected"].includes(String(status)) && !["cancelled", "rejected"].includes(existing.status)) {
      await tx.equipment.update({ where: { id: existing.equipmentId }, data: { availableQuantity: { increment: 1 }, status: "available" } });
    }
    return tx.booking.update({ where: { id }, data: { status, notes } });
  });
  return bookingDto(updated);
}
