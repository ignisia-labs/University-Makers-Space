import { z } from "zod";
import { isValidLocalDate } from "./lab-time.js";

const uuid = z.string().uuid();
const localDate = z.string().refine(isValidLocalDate, "Use a valid date in YYYY-MM-DD format");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time");
const timeZone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA time zone");

const labParams = z.object({ labId: uuid }).strict();

const weeklySchedule = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    opensAt: clockTime,
    closesAt: clockTime,
  })
  .strict()
  .refine(
    (value) =>
      !value.isOpen ||
      Number(value.opensAt.slice(0, 2)) * 60 + Number(value.opensAt.slice(3)) <
        Number(value.closesAt.slice(0, 2)) * 60 + Number(value.closesAt.slice(3)),
    { message: "Closing time must be after opening time", path: ["closesAt"] },
  );

export const labConfigurationSchema = z.object({ params: labParams });

export const updateLabConfigurationSchema = z.object({
  params: labParams,
  body: z
    .object({
      configurationVersion: z.number().int().min(1),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(1000).nullable().optional(),
      timeZone,
      slotDurationMinutes: z.number().int().min(5).max(240),
      bookingCapacity: z.number().int().min(1).max(500),
      quickVisitsEnabled: z.boolean(),
      quickVisitCapacity: z.number().int().min(1).max(500),
      bookingHorizonDays: z.number().int().min(1).max(365),
      cancellationWindowHours: z.number().int().min(0).max(168),
      maxFutureBookingsPerProject: z.number().int().min(1).max(100).nullable(),
      // Version 1 booking eligibility is an RFP invariant: only VERIFIED projects may book.
      projectVerificationRequired: z.literal(true),
      teamLeaderAttendanceRequired: z.boolean(),
      weeklySchedule: z
        .array(weeklySchedule)
        .length(7)
        .refine(
          (rows) => new Set(rows.map((row) => row.dayOfWeek)).size === 7,
          "Provide each weekday exactly once",
        ),
    })
    .strict(),
});

export const upsertLabDateExceptionSchema = z.object({
  params: labParams,
  body: z
    .object({
      date: localDate,
      isClosed: z.boolean(),
      opensAt: clockTime.nullable(),
      closesAt: clockTime.nullable(),
      reason: z.string().trim().min(3).max(500),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.isClosed) {
        if (value.opensAt !== null || value.closesAt !== null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Closed dates cannot include opening hours",
            path: ["opensAt"],
          });
        }
        return;
      }
      if (!value.opensAt || !value.closesAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Special hours require both opening and closing times",
          path: ["opensAt"],
        });
        return;
      }
      const opens = Number(value.opensAt.slice(0, 2)) * 60 + Number(value.opensAt.slice(3));
      const closes = Number(value.closesAt.slice(0, 2)) * 60 + Number(value.closesAt.slice(3));
      if (opens >= closes) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Closing time must be after opening time",
          path: ["closesAt"],
        });
      }
    }),
});

export const deleteLabDateExceptionSchema = z.object({
  params: labParams.extend({ exceptionId: uuid }),
});

export const regenerateLabSlotsSchema = z.object({
  params: labParams,
  body: z
    .object({
      fromDate: localDate.optional(),
      toDate: localDate.optional(),
    })
    .strict()
    .refine((value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate, {
      message: "toDate must be on or after fromDate",
      path: ["toDate"],
    }),
});

const availabilityQuery = z
  .object({
    projectId: uuid.optional(),
    participantCount: z.coerce.number().int().min(1).max(500).default(1),
  })
  .strict();

export const availabilityDatesSchema = z.object({
  params: labParams,
  query: availabilityQuery,
});

export const dailyAvailabilitySchema = z.object({
  params: labParams,
  query: availabilityQuery.extend({ date: localDate }),
});

export type LabConfigurationInput = z.infer<typeof updateLabConfigurationSchema>["body"];
export type DateExceptionInput = z.infer<typeof upsertLabDateExceptionSchema>["body"];
