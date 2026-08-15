import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { projectDto } from "../../utils/serializers.js";

const sortFields = new Set(["title", "status", "createdAt", "updatedAt"]);

export async function list(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...(query.search ? { OR: [{ title: { contains: String(query.search), mode: "insensitive" } }, { description: { contains: String(query.search), mode: "insensitive" } }] } : {}),
    ...(query.status ? { status: query.status as Prisma.EnumProjectStatusFilter } : {}),
    ...(query.creatorId ? { creatorId: String(query.creatorId) } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({ where, orderBy: { [sortBy]: query.order ?? "asc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data: rows.map(projectDto), meta: meta(page, limit, total) };
}

export async function get(id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  return projectDto(project);
}

export async function create(creatorId: string, data: { title: string; description: string; tags: string[] }) {
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({ data: { ...data, creatorId } });
    await tx.projectMember.create({ data: { projectId: created.id, userId: creatorId, role: "creator" } });
    return created;
  });
  return projectDto(project);
}

export async function update(id: string, data: Prisma.ProjectUpdateInput) {
  await get(id);
  return projectDto(await prisma.project.update({ where: { id }, data }));
}

export async function addMember(projectId: string, userId: string, role: string) {
  await get(projectId);
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
  return prisma.projectMember.create({ data: { projectId, userId, role } });
}

export async function remove(id: string) {
  await get(id);
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date(), status: "archived" } });
}
