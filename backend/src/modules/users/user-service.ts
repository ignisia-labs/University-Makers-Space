import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { userDto } from "../../utils/serializers.js";

const sortFields = new Set(["name", "email", "createdAt", "updatedAt"]);

export async function list(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.search ? { OR: [{ name: { contains: String(query.search), mode: "insensitive" } }, { email: { contains: String(query.search), mode: "insensitive" } }] } : {}),
    ...(query.role ? { roles: { has: String(query.role) } } : {}),
    ...(query.isActive !== undefined ? { isActive: Boolean(query.isActive) } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { [sortBy]: query.order ?? "asc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data: rows.map(userDto), meta: meta(page, limit, total) };
}

export async function get(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
  return userDto(user);
}

export async function update(id: string, data: Prisma.UserUpdateInput) {
  await get(id);
  const user = await prisma.user.update({ where: { id }, data });
  return userDto(user);
}

export async function remove(id: string) {
  await get(id);
  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, tokenVersion: { increment: 1 } },
  });
}
