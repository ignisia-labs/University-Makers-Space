import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { notificationDto } from "../../utils/serializers.js";

export async function list(query: Record<string, unknown>, userId: string) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const where: Prisma.NotificationWhereInput = {
    userId,
    deletedAt: null,
    ...(query.isRead !== undefined ? { isRead: Boolean(query.isRead) } : {}),
    ...(query.type ? { type: String(query.type) } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: rows.map(notificationDto), meta: meta(page, limit, total) };
}

export async function create(data: Prisma.NotificationUncheckedCreateInput) {
  return notificationDto(await prisma.notification.create({ data }));
}

export async function markRead(id: string, userId: string, isRead: boolean) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!notification) throw new ApiError(404, "NOT_FOUND", "Notification not found");
  return notificationDto(
    await prisma.notification.update({
      where: { id },
      data: { isRead, readAt: isRead ? new Date() : null },
    }),
  );
}
