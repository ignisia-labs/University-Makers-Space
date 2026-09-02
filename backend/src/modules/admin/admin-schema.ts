import { z } from "zod";
import { idParam } from "../shared/schemas.js";
import { exportKinds } from "./export-service.js";

const uuid = z.string().uuid();
const code = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "code may use letters, digits, dot, underscore and hyphen",
  );
const name = z.string().trim().min(2).max(120);

export const dashboardSchema = z.object({
  params: z.object({ labId: uuid }).strict(),
  query: z.object({}).strict(),
});

export const auditListSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      actorUserId: uuid.optional(),
      action: z.string().trim().max(80).optional(),
      entityType: z.string().trim().max(60).optional(),
      entityId: z.string().trim().max(64).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .strict()
    .refine((value) => !value.from || !value.to || new Date(value.to) >= new Date(value.from), {
      message: "`to` must be on or after `from`",
      path: ["to"],
    }),
});

export const exportSchema = z.object({
  params: z.object({ kind: z.enum(exportKinds) }).strict(),
  query: z
    .object({
      labId: uuid.optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .strict()
    .refine((value) => !value.from || !value.to || new Date(value.to) >= new Date(value.from), {
      message: "`to` must be on or after `from`",
      path: ["to"],
    }),
});

export const createDepartmentSchema = z.object({
  body: z.object({ code, name }).strict(),
});
export const updateDepartmentSchema = z.object({
  params: idParam,
  body: z
    .object({ code: code.optional(), name: name.optional(), isActive: z.boolean().optional() })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});

export const createProgrammeSchema = z.object({
  body: z.object({ departmentId: uuid, code, name }).strict(),
});
export const updateProgrammeSchema = z.object({
  params: idParam,
  body: z
    .object({ code: code.optional(), name: name.optional(), isActive: z.boolean().optional() })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});

export const academicYearSchema = z.object({
  body: z
    .object({
      value: z.coerce.number().int().min(1).max(12),
      label: z.string().trim().min(1).max(40),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const createCategorySchema = z.object({
  body: z.object({ labId: uuid, name }).strict(),
});
export const updateCategorySchema = z.object({
  params: idParam,
  body: z
    .object({ name: name.optional(), isActive: z.boolean().optional() })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});

export const createConsumableSchema = z.object({
  body: z
    .object({
      labId: uuid,
      categoryId: uuid,
      domainId: uuid.nullable().optional(),
      name,
      unit: z.string().trim().min(1).max(24),
      description: z.string().trim().max(500).nullable().optional(),
      variants: z.array(z.string().trim().min(1).max(120)).max(24).optional(),
      maxPerProject: z.number().int().min(1).max(10_000).nullable().optional(),
      stockQuantity: z.number().int().min(0).max(1_000_000).optional(),
      lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable().optional(),
    })
    .strict(),
});
export const updateConsumableSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: name.optional(),
      categoryId: uuid.optional(),
      domainId: uuid.nullable().optional(),
      unit: z.string().trim().min(1).max(24).optional(),
      description: z.string().trim().max(500).nullable().optional(),
      variants: z.array(z.string().trim().min(1).max(120)).max(24).optional(),
      maxPerProject: z.number().int().min(1).max(10_000).nullable().optional(),
      // Restocking is the only thing that raises this. Issued material is gone.
      stockQuantity: z.number().int().min(0).max(1_000_000).optional(),
      lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});

export const labScopedListSchema = z.object({
  query: z.object({ labId: uuid.optional() }).strict(),
});

// ─── divisions and faculty ───────────────────────────────────────────────────

const divisionName = z.string().trim().min(2).max(120);
/** A prefix is an honorific, not a sentence: "Dr.", "Prof.", "Mr.". */
const prefix = z.string().trim().min(1).max(24);
const personName = z.string().trim().min(2).max(120);

export const createDivisionSchema = z.object({
  body: z.object({ name: divisionName }).strict(),
});
export const updateDivisionSchema = z.object({
  params: idParam,
  body: z
    .object({ name: divisionName.optional(), isActive: z.boolean().optional() })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});

export const listFacultySchema = z.object({
  query: z
    .object({
      search: z.string().trim().max(120).optional(),
      divisionId: uuid.optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .strict(),
});

export const addFacultySchema = z.object({
  body: z
    .object({
      prefix: prefix.nullable().optional(),
      name: personName,
      email: z.string().trim().email().toLowerCase(),
      divisionId: uuid.nullable().optional(),
    })
    .strict(),
});

export const updateFacultySchema = z.object({
  params: idParam,
  body: z
    .object({
      prefix: prefix.nullable().optional(),
      name: personName.optional(),
      divisionId: uuid.nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});

export const createDomainSchema = z.object({
  body: z
    .object({
      labId: uuid,
      name,
      tagline: z.string().trim().max(120).nullable().optional(),
      imageUrl: z.string().url().max(2000).nullable().optional(),
    })
    .strict(),
});

export const updateDomainSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: name.optional(),
      tagline: z.string().trim().max(120).nullable().optional(),
      imageUrl: z.string().url().max(2000).nullable().optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied" }),
});
