import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { cacheKey, getJson, invalidate, setJson } from "../../utils/cache.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { equipmentDto } from "../../utils/serializers.js";

const sortFields = new Set(["name", "category", "status", "createdAt", "updatedAt"]);

export async function list(query: Record<string, unknown>) {
  const key = cacheKey("equipment:list", query);
  const cached = await getJson<{ data: ReturnType<typeof equipmentDto>[]; meta: ReturnType<typeof meta> }>(key);
  if (cached) return cached;
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const where: Prisma.EquipmentWhereInput = {
    deletedAt: null,
    ...(query.search ? { OR: textSearch(String(query.search)) } : {}),
    ...(query.category ? { category: String(query.category) } : {}),
    ...(query.status ? { status: query.status as Prisma.EnumEquipmentStatusFilter } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      orderBy: { [sortBy]: query.order ?? "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const payload = { data: rows.map(equipmentDto), meta: meta(page, limit, total) };
  await setJson(key, payload, 60);
  return payload;
}

export async function get(id: string) {
  const item = await prisma.equipment.findFirst({ where: { id, deletedAt: null } });
  if (!item) throw new ApiError(404, "NOT_FOUND", "Equipment not found");
  return equipmentDto(item);
}

export async function create(data: Prisma.EquipmentCreateInput) {
  const item = await prisma.equipment.create({ data });
  await invalidate("equipment:list:*");
  return equipmentDto(item);
}

export async function update(id: string, data: Prisma.EquipmentUpdateInput) {
  await get(id);
  const item = await prisma.equipment.update({ where: { id }, data });
  await invalidate("equipment:list:*");
  return equipmentDto(item);
}

export async function remove(id: string) {
  await get(id);
  await prisma.equipment.update({ where: { id }, data: { deletedAt: new Date(), visible: false } });
  await invalidate("equipment:list:*");
}

function textSearch(search: string) {
  return [
    { name: { contains: search, mode: "insensitive" as const } },
    { description: { contains: search, mode: "insensitive" as const } },
    { category: { contains: search, mode: "insensitive" as const } },
  ];
}
