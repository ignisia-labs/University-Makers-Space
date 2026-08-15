import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { cacheKey, getJson, invalidate, setJson } from "../../utils/cache.js";
import { ApiError } from "../../utils/api-error.js";
import { eventDto } from "../../utils/serializers.js";
import { meta } from "../../utils/pagination.js";

const sortFields = new Set(["title", "startTime", "createdAt"]);

export async function list(query: Record<string, unknown>) {
  const key = cacheKey("events:list", query);
  const cached = await getJson<{
    data: ReturnType<typeof eventDto>[];
    meta: ReturnType<typeof meta>;
  }>(key);
  if (cached) return cached;
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "startTime";
  const where: Prisma.EventWhereInput = {
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { title: { contains: String(query.search), mode: "insensitive" } },
            { description: { contains: String(query.search), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.organizerId ? { organizerId: String(query.organizerId) } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: { [sortBy]: query.order ?? "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const payload = { data: rows.map(eventDto), meta: meta(page, limit, total) };
  await setJson(key, payload, 120);
  return payload;
}

export async function get(id: string) {
  const event = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!event) throw new ApiError(404, "NOT_FOUND", "Event not found");
  return eventDto(event);
}

export async function create(organizerId: string, data: Record<string, unknown>) {
  const event = await prisma.event.create({ data: normalize(organizerId, data) });
  await invalidate("events:list:*");
  return eventDto(event);
}

export async function update(id: string, data: Record<string, unknown>) {
  await get(id);
  const event = await prisma.event.update({ where: { id }, data: normalize(undefined, data) });
  await invalidate("events:list:*");
  return eventDto(event);
}

export async function register(eventId: string, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM "events" WHERE id = ${eventId}::uuid AND "deleted_at" IS NULL FOR UPDATE
      `);
      const event = await tx.event.findFirst({ where: { id: eventId, deletedAt: null } });
      if (!event) throw new ApiError(404, "NOT_FOUND", "Event not found");
      const count = await tx.eventRegistration.count({ where: { eventId } });
      if (count >= event.capacity) throw new ApiError(409, "EVENT_FULL", "Event capacity is full");
      return tx.eventRegistration.create({ data: { eventId, userId } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function remove(id: string) {
  await get(id);
  await prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
  await invalidate("events:list:*");
}

function normalize(organizerId: string | undefined, data: Record<string, unknown>) {
  return {
    ...data,
    ...(organizerId ? { organizerId } : {}),
    ...(data.startTime ? { startTime: new Date(String(data.startTime)) } : {}),
    ...(data.endTime ? { endTime: new Date(String(data.endTime)) } : {}),
  } as Prisma.EventUncheckedCreateInput;
}
