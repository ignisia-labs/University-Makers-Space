import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { invalidate } from "../../utils/cache.js";
import type { RequestContext, Viewer } from "../visits/visit-shared.js";

/**
 * Reference-data administration.
 *
 * Two rules hold across every entity here:
 *
 *  1. Reference rows are *deactivated*, never deleted, once anything points at
 *     them. Deleting a department would orphan every student profile that cites
 *     it; `isActive=false` removes it from pickers while keeping history intact.
 *  2. Every mutation writes an audit record, because reference data silently
 *     shapes who can do what.
 */

type AuditableEntity =
  | "Department"
  | "Programme"
  | "AcademicYearOption"
  | "EquipmentCategory"
  | "ConsumableCategory"
  | "Consumable"
  | "Domain";

async function record(
  tx: Prisma.TransactionClient,
  viewer: Viewer,
  context: RequestContext,
  action: string,
  entityType: AuditableEntity,
  entityId: string,
  metadata: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: viewer.id,
      action,
      entityType,
      entityId,
      metadata,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

/** Reference data feeds cached dropdowns; drop those caches on every write. */
async function bustReferenceCaches() {
  await invalidate("reference:*");
}

// ─── departments ─────────────────────────────────────────────────────────────

export async function createDepartment(
  input: { code: string; name: string },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.department.create({ data: input });
    await record(tx, viewer, context, "reference.department_created", "Department", row.id, input);
    return row;
  });
  await bustReferenceCaches();
  return created;
}

export async function updateDepartment(
  id: string,
  input: { code?: string; name?: string; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.department.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Department not found");
    // Deactivating a department must not leave its programmes selectable.
    if (input.isActive === false) {
      await tx.programme.updateMany({ where: { departmentId: id }, data: { isActive: false } });
    }
    const row = await tx.department.update({ where: { id }, data: input });
    await record(tx, viewer, context, "reference.department_updated", "Department", id, {
      from: { code: before.code, name: before.name, isActive: before.isActive },
      to: input,
    });
    return row;
  });
  await bustReferenceCaches();
  return updated;
}

/**
 * Removes a department outright.
 *
 * Deletion is only offered when nothing depends on the row. `student_profiles`
 * references both department and programme with `onDelete: Restrict`, so a
 * department that any student has ever selected cannot be dropped without
 * destroying their record — deactivation is the correct answer there, and the
 * error says so rather than surfacing a raw foreign-key failure.
 *
 * Its programmes go with it in the same transaction: they are meaningless
 * without their department, and requiring the operator to clear them one by one
 * first would be busywork.
 */
export async function deleteDepartment(id: string, viewer: Viewer, context: RequestContext = {}) {
  return prisma
    .$transaction(async (tx) => {
      const department = await tx.department.findUnique({
        where: { id },
        include: { _count: { select: { students: true, programmes: true } } },
      });
      if (!department) throw new ApiError(404, "NOT_FOUND", "Department not found");

      const studentsInProgrammes = await tx.studentProfile.count({
        where: { programme: { departmentId: id } },
      });
      const dependants = department._count.students + studentsInProgrammes;
      if (dependants > 0) {
        throw new ApiError(
          409,
          "DEPARTMENT_IN_USE",
          `${dependants} student ${dependants === 1 ? "profile refers" : "profiles refer"} to this department. Deactivate it instead — that hides it from new sign-ups while keeping those records intact.`,
        );
      }

      const removedProgrammes = await tx.programme.deleteMany({ where: { departmentId: id } });
      await tx.department.delete({ where: { id } });
      await record(tx, viewer, context, "reference.department_deleted", "Department", id, {
        code: department.code,
        name: department.name,
        removedProgrammes: removedProgrammes.count,
      });
      return { removedProgrammes: removedProgrammes.count };
    })
    .then(async (result) => {
      await bustReferenceCaches();
      return result;
    });
}

export function listDepartments() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { programmes: true, students: true } } },
  });
}

// ─── programmes ──────────────────────────────────────────────────────────────

export async function createProgramme(
  input: { departmentId: string; code: string; name: string },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const created = await prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw new ApiError(404, "NOT_FOUND", "Department not found");
    if (!department.isActive) {
      throw new ApiError(
        409,
        "DEPARTMENT_INACTIVE",
        "Reactivate the department before adding programmes to it",
      );
    }
    const row = await tx.programme.create({ data: input });
    await record(tx, viewer, context, "reference.programme_created", "Programme", row.id, input);
    return row;
  });
  await bustReferenceCaches();
  return created;
}

export async function updateProgramme(
  id: string,
  input: { code?: string; name?: string; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.programme.findUnique({
      where: { id },
      include: { department: { select: { isActive: true } } },
    });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Programme not found");
    if (input.isActive === true && !before.department.isActive) {
      throw new ApiError(
        409,
        "DEPARTMENT_INACTIVE",
        "Reactivate the parent department before reactivating this programme",
      );
    }
    const row = await tx.programme.update({ where: { id }, data: input });
    await record(tx, viewer, context, "reference.programme_updated", "Programme", id, {
      from: { code: before.code, name: before.name, isActive: before.isActive },
      to: input,
    });
    return row;
  });
  await bustReferenceCaches();
  return updated;
}

/** Removes a programme, unless a student profile still points at it. */
export async function deleteProgramme(id: string, viewer: Viewer, context: RequestContext = {}) {
  return prisma
    .$transaction(async (tx) => {
      const programme = await tx.programme.findUnique({
        where: { id },
        include: { _count: { select: { students: true } } },
      });
      if (!programme) throw new ApiError(404, "NOT_FOUND", "Programme not found");
      if (programme._count.students > 0) {
        const count = programme._count.students;
        throw new ApiError(
          409,
          "PROGRAMME_IN_USE",
          `${count} student ${count === 1 ? "profile refers" : "profiles refer"} to this programme. Deactivate it instead — that hides it from new sign-ups while keeping those records intact.`,
        );
      }
      await tx.programme.delete({ where: { id } });
      await record(tx, viewer, context, "reference.programme_deleted", "Programme", id, {
        code: programme.code,
        name: programme.name,
        departmentId: programme.departmentId,
      });
      return { deleted: true };
    })
    .then(async (result) => {
      await bustReferenceCaches();
      return result;
    });
}

export function listProgrammes(departmentId?: string) {
  return prisma.programme.findMany({
    where: departmentId ? { departmentId } : {},
    orderBy: [{ departmentId: "asc" }, { name: "asc" }],
    include: {
      department: { select: { id: true, code: true, name: true } },
      _count: { select: { students: true } },
    },
  });
}

// ─── academic years ──────────────────────────────────────────────────────────

export async function upsertAcademicYear(
  input: { value: number; label: string; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.academicYearOption.upsert({
      where: { value: input.value },
      update: {
        label: input.label,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      create: { value: input.value, label: input.label, isActive: input.isActive ?? true },
    });
    await record(
      tx,
      viewer,
      context,
      "reference.academic_year_saved",
      "AcademicYearOption",
      saved.id,
      input,
    );
    return saved;
  });
  await bustReferenceCaches();
  return row;
}

export function listAcademicYears() {
  return prisma.academicYearOption.findMany({ orderBy: { value: "asc" } });
}

// ─── equipment categories ────────────────────────────────────────────────────

/* ── Domains ─────────────────────────────────────────────────────────────── */

export async function listDomains(labId: string) {
  return prisma.domain.findMany({
    where: { labId },
    include: { _count: { select: { equipment: true, consumables: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createDomain(
  input: { labId: string; name: string; tagline?: string | null; imageUrl?: string | null },
  viewer: Viewer,
  context: RequestContext = {},
) {
  return prisma.$transaction(async (tx) => {
    // New domains land at the end of the list rather than jumping the queue.
    const last = await tx.domain.aggregate({
      where: { labId: input.labId },
      _max: { sortOrder: true },
    });
    const row = await tx.domain.create({
      data: {
        labId: input.labId,
        name: input.name,
        tagline: input.tagline ?? null,
        imageUrl: input.imageUrl ?? null,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    await record(tx, viewer, context, "reference.domain_created", "Domain", row.id, {
      name: row.name,
    });
    return row;
  });
}

export async function updateDomain(
  id: string,
  input: {
    name?: string;
    tagline?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
  viewer: Viewer,
  context: RequestContext = {},
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.domain.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Domain not found");
    const row = await tx.domain.update({ where: { id }, data: input });
    await record(tx, viewer, context, "reference.domain_updated", "Domain", id, {
      before: { name: before.name, isActive: before.isActive },
      after: { name: row.name, isActive: row.isActive },
    });
    return row;
  });
}

/**
 * Deleting a domain removes the grouping, never its contents.
 *
 * The machines and materials filed under it survive and simply become
 * unassigned — a domain is a way of arranging the catalogue, not a container
 * that owns it, and a mis-click must not take the shelf with it.
 */
export async function deleteDomain(id: string, viewer: Viewer, context: RequestContext = {}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.domain.findUnique({
      where: { id },
      include: { _count: { select: { equipment: true, consumables: true } } },
    });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Domain not found");
    await tx.domain.delete({ where: { id } });
    await record(tx, viewer, context, "reference.domain_deleted", "Domain", id, {
      name: before.name,
      releasedEquipment: before._count.equipment,
      releasedConsumables: before._count.consumables,
    });
    return {
      released: {
        equipment: before._count.equipment,
        consumables: before._count.consumables,
      },
    };
  });
}

export async function createEquipmentCategory(
  input: { labId: string; name: string },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.equipmentCategory.create({ data: input });
    await record(
      tx,
      viewer,
      context,
      "reference.equipment_category_created",
      "EquipmentCategory",
      row.id,
      input,
    );
    return row;
  });
  await bustReferenceCaches();
  return created;
}

export async function updateEquipmentCategory(
  id: string,
  input: { name?: string; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.equipmentCategory.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Equipment category not found");
    const row = await tx.equipmentCategory.update({ where: { id }, data: input });
    await record(
      tx,
      viewer,
      context,
      "reference.equipment_category_updated",
      "EquipmentCategory",
      id,
      { from: { name: before.name, isActive: before.isActive }, to: input },
    );
    return row;
  });
  await bustReferenceCaches();
  return updated;
}

export function listEquipmentCategories(labId?: string) {
  return prisma.equipmentCategory.findMany({
    where: labId ? { labId } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { equipment: true } } },
  });
}

// ─── consumables ─────────────────────────────────────────────────────────────

export async function createConsumableCategory(
  input: { labId: string; name: string },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.consumableCategory.create({ data: input });
    await record(
      tx,
      viewer,
      context,
      "reference.consumable_category_created",
      "ConsumableCategory",
      row.id,
      input,
    );
    return row;
  });
  await bustReferenceCaches();
  return created;
}

export async function updateConsumableCategory(
  id: string,
  input: { name?: string; isActive?: boolean },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.consumableCategory.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Consumable category not found");
    if (input.isActive === false) {
      await tx.consumable.updateMany({ where: { categoryId: id }, data: { isActive: false } });
    }
    const row = await tx.consumableCategory.update({ where: { id }, data: input });
    await record(
      tx,
      viewer,
      context,
      "reference.consumable_category_updated",
      "ConsumableCategory",
      id,
      { from: { name: before.name, isActive: before.isActive }, to: input },
    );
    return row;
  });
  await bustReferenceCaches();
  return updated;
}

export async function createConsumable(
  input: {
    labId: string;
    categoryId: string;
    domainId?: string | null;
    name: string;
    unit: string;
    description?: string | null;
    variants?: string[];
    maxPerProject?: number | null;
    stockQuantity?: number;
    lowStockThreshold?: number | null;
  },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.consumableCategory.findUnique({ where: { id: input.categoryId } });
    if (!category || category.labId !== input.labId) {
      throw new ApiError(
        400,
        "CATEGORY_LAB_MISMATCH",
        "The category does not belong to the selected MakerSpace",
      );
    }
    if (!category.isActive) {
      throw new ApiError(409, "CATEGORY_INACTIVE", "Reactivate the category before adding items");
    }
    const row = await tx.consumable.create({ data: input });
    await record(tx, viewer, context, "reference.consumable_created", "Consumable", row.id, input);
    return row;
  });
  await bustReferenceCaches();
  return created;
}

export async function updateConsumable(
  id: string,
  input: {
    name?: string;
    categoryId?: string;
    domainId?: string | null;
    unit?: string;
    description?: string | null;
    variants?: string[];
    maxPerProject?: number | null;
    stockQuantity?: number;
    lowStockThreshold?: number | null;
    isActive?: boolean;
  },
  viewer: Viewer,
  context: RequestContext = {},
) {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.consumable.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Consumable not found");
    const row = await tx.consumable.update({ where: { id }, data: input });
    await record(tx, viewer, context, "reference.consumable_updated", "Consumable", id, {
      from: {
        name: before.name,
        unit: before.unit,
        isActive: before.isActive,
        stockQuantity: before.stockQuantity,
      },
      to: input,
    });
    return row;
  });
  await bustReferenceCaches();
  return updated;
}

export function listConsumables(labId?: string) {
  return prisma.consumable.findMany({
    where: labId ? { labId } : {},
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    include: { category: { select: { id: true, name: true, isActive: true } } },
  });
}

export function listConsumableCategories(labId?: string) {
  return prisma.consumableCategory.findMany({
    where: labId ? { labId } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { consumables: true } } },
  });
}
