import { prisma } from "../../config/db.js";

export function listDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function listProgrammes(departmentId?: string) {
  return prisma.programme.findMany({
    where: {
      isActive: true,
      department: { isActive: true },
      ...(departmentId ? { departmentId } : {}),
    },
    select: { id: true, departmentId: true, code: true, name: true },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
}

export function listAcademicYears() {
  return prisma.academicYearOption.findMany({
    where: { isActive: true },
    select: { id: true, value: true, label: true },
    orderBy: { value: "asc" },
  });
}

export function listLabs() {
  return prisma.lab.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      timeZone: true,
      slotDurationMinutes: true,
      bookingCapacity: true,
      quickVisitCapacity: true,
    },
    orderBy: { name: "asc" },
  });
}

export function listEquipmentCategories(labId?: string) {
  return prisma.equipmentCategory.findMany({
    where: { isActive: true, lab: { isActive: true }, ...(labId ? { labId } : {}) },
    select: { id: true, labId: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listProjectResources(labId: string) {
  const lab = await prisma.lab.findFirst({
    where: { id: labId, isActive: true },
    select: { id: true },
  });
  if (!lab) return { equipment: [], consumables: [] };
  const [equipment, consumables] = await Promise.all([
    prisma.equipment.findMany({
      where: { labId, visible: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.consumable.findMany({
      where: { labId, isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        description: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  return { equipment, consumables };
}
