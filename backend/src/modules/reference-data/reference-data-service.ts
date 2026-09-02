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

/**
 * The catalogue a student picks their kit from, grouped by domain.
 *
 * Domains are the entry point — a build is "digital fabrication" or
 * "electronics" long before it is a particular printer — so the shape returned
 * here is domain-first, with each domain carrying its own machines and
 * materials. Anything not yet assigned to a domain still appears, under an
 * unnamed group, because a machine that exists must be selectable even if
 * nobody has filed it yet.
 *
 * `equipment` and `consumables` are also returned flat, since editing an
 * existing project needs to resolve an id without walking every domain.
 */
export async function listProjectResources(labId: string) {
  const lab = await prisma.lab.findFirst({
    where: { id: labId, isActive: true },
    select: { id: true },
  });
  if (!lab) return { domains: [], equipment: [], consumables: [] };

  const [domains, equipment, consumables] = await Promise.all([
    prisma.domain.findMany({
      where: { labId, isActive: true },
      select: { id: true, name: true, tagline: true, imageUrl: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.equipment.findMany({
      where: { labId, visible: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        imageUrl: true,
        specs: true,
        domainId: true,
        totalQuantity: true,
        availableQuantity: true,
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
        variants: true,
        maxPerProject: true,
        stockQuantity: true,
        lowStockThreshold: true,
        domainId: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  const grouped = domains.map((domain) => ({
    ...domain,
    equipment: equipment.filter((item) => item.domainId === domain.id),
    consumables: consumables.filter((item) => item.domainId === domain.id),
  }));

  const looseEquipment = equipment.filter(
    (item) => !item.domainId || !domains.some((domain) => domain.id === item.domainId),
  );
  const looseConsumables = consumables.filter(
    (item) => !item.domainId || !domains.some((domain) => domain.id === item.domainId),
  );
  if (looseEquipment.length > 0 || looseConsumables.length > 0) {
    grouped.push({
      id: "unassigned",
      name: "Everything else",
      tagline: "Not yet filed under a domain",
      imageUrl: null,
      sortOrder: 9999,
      equipment: looseEquipment,
      consumables: looseConsumables,
    });
  }

  return { domains: grouped, equipment, consumables };
}
