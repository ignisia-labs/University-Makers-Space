import { EquipmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { cacheKey, getJson, invalidate, setJson } from "../../utils/cache.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { equipmentDto } from "../../utils/serializers.js";

const sortFields = new Set(["name", "status", "createdAt", "updatedAt"]);

export async function list(query: Record<string, unknown>) {
  const key = cacheKey("equipment:list", query);
  const cached = await getJson<{
    data: ReturnType<typeof equipmentDto>[];
    meta: ReturnType<typeof meta>;
  }>(key);
  if (cached) return cached;
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const where: Prisma.EquipmentWhereInput = {
    deletedAt: null,
    ...(query.search ? { OR: textSearch(String(query.search)) } : {}),
    ...(query.labId ? { labId: String(query.labId) } : {}),
    ...(query.categoryId ? { categoryId: String(query.categoryId) } : {}),
    ...(query.category
      ? { category: { name: { equals: String(query.category), mode: "insensitive" } } }
      : {}),
    ...(query.status ? { status: query.status as Prisma.EnumEquipmentStatusFilter } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: { category: true },
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
  const item = await prisma.equipment.findFirst({
    where: { id, deletedAt: null },
    include: { category: true },
  });
  if (!item) throw new ApiError(404, "NOT_FOUND", "Equipment not found");
  return equipmentDto(item);
}

export async function create(data: Prisma.EquipmentUncheckedCreateInput) {
  await validateCategory(data.labId, data.categoryId);
  const item = await prisma.equipment.create({ data, include: { category: true } });
  await invalidate("equipment:list:*");
  return equipmentDto(item);
}

export async function update(id: string, data: Prisma.EquipmentUncheckedUpdateInput) {
  const existing = await prisma.equipment.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Equipment not found");
  const labId = typeof data.labId === "string" ? data.labId : existing.labId;
  const categoryId = typeof data.categoryId === "string" ? data.categoryId : existing.categoryId;
  await validateCategory(labId, categoryId);
  const totalQuantity =
    typeof data.totalQuantity === "number" ? data.totalQuantity : existing.totalQuantity;
  const availableQuantity =
    typeof data.availableQuantity === "number"
      ? data.availableQuantity
      : existing.availableQuantity;
  if (availableQuantity > totalQuantity) {
    throw new ApiError(400, "INVALID_QUANTITY", "Available quantity cannot exceed total quantity");
  }
  const item = await prisma.equipment.update({ where: { id }, data, include: { category: true } });
  await invalidate("equipment:list:*");
  return equipmentDto(item);
}

export async function updateAvailability(
  id: string,
  data: { status?: EquipmentStatus; availableQuantity?: number; reason: string },
  actorId: string,
) {
  const item = await prisma.$transaction(
    async (tx) => {
      const lockedEquipment = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM "equipment"
        WHERE id = ${id}::uuid AND "deleted_at" IS NULL
        FOR UPDATE
      `);
      if (lockedEquipment.length !== 1) {
        throw new ApiError(404, "NOT_FOUND", "Equipment not found");
      }
      const existing = await tx.equipment.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Equipment not found");

      const availableQuantity = data.availableQuantity ?? existing.availableQuantity;
      if (availableQuantity > existing.totalQuantity) {
        throw new ApiError(
          400,
          "INVALID_QUANTITY",
          "Available quantity cannot exceed total quantity",
        );
      }

      const updated = await tx.equipment.update({
        where: { id },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.availableQuantity !== undefined
            ? { availableQuantity: data.availableQuantity }
            : {}),
        },
        include: { category: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "equipment.availability_changed",
          entityType: "Equipment",
          entityId: id,
          metadata: {
            reason: data.reason,
            before: {
              status: existing.status,
              availableQuantity: existing.availableQuantity,
            },
            after: {
              status: updated.status,
              availableQuantity: updated.availableQuantity,
            },
          },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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
    { category: { name: { contains: search, mode: "insensitive" as const } } },
  ];
}

async function validateCategory(labId: string | undefined, categoryId: string | undefined) {
  if (!labId || !categoryId) return;
  const category = await prisma.equipmentCategory.findFirst({
    where: { id: categoryId, labId, isActive: true },
  });
  if (!category)
    throw new ApiError(400, "INVALID_CATEGORY", "Category does not belong to this lab");
}
