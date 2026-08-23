import { BookingStatus, Prisma, ProjectStatus, SlotStatus } from "@prisma/client";
import { hasPermission } from "../../config/permissions.js";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import type { DateExceptionInput, LabConfigurationInput } from "./lab-schema.js";
import {
  addLocalDays,
  buildSlotBlueprints,
  dbDateToLocalDate,
  enumerateLocalDates,
  localDateDbValue,
  localToday,
  minuteToTime,
  resolveDayPolicy,
  timeToMinute,
  type DateException,
  type WeeklySchedule,
} from "./lab-time.js";

type Viewer = NonNullable<Express.Request["user"]>;
type DbClient = Prisma.TransactionClient | typeof prisma;

const capacityBookingStatuses = [BookingStatus.CONFIRMED, BookingStatus.ACTIVE];
const unavailableEquipmentStatuses = new Set([
  "UNAVAILABLE",
  "UNDER_MAINTENANCE",
  "DAMAGED",
  "OUT_OF_SERVICE",
]);

type PolicyLab = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  timeZone: string;
  slotDurationMinutes: number;
  bookingCapacity: number;
  quickVisitCapacity: number;
  quickVisitsEnabled: boolean;
  bookingHorizonDays: number;
  cancellationWindowHours: number;
  maxFutureBookingsPerProject: number | null;
  projectVerificationRequired: boolean;
  teamLeaderAttendanceRequired: boolean;
  configurationVersion: number;
  isActive: boolean;
  updatedAt: Date;
  schedules: WeeklySchedule[];
};

export async function getConfiguration(labId: string) {
  const lab = await loadLab(prisma, labId);
  const today = localToday(lab.timeZone);
  const exceptions = await prisma.labDateException.findMany({
    where: {
      labId,
      localDate: {
        gte: localDateDbValue(today),
        lte: localDateDbValue(addLocalDays(today, 365)),
      },
    },
    orderBy: { localDate: "asc" },
    take: 366,
  });
  return configurationDto(lab, exceptions);
}

export async function updateConfiguration(
  labId: string,
  input: LabConfigurationInput,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await lockLab(tx, labId);
      const existing = await loadLab(tx, labId);
      if (existing.configurationVersion !== input.configurationVersion) {
        throw new ApiError(
          409,
          "CONFIGURATION_CHANGED",
          "The MakerSpace configuration changed. Reload before saving again.",
        );
      }
      if (input.bookingCapacity < existing.bookingCapacity) {
        await assertFutureCapacityCompatible(tx, labId, input.bookingCapacity);
      }

      await tx.lab.update({
        where: { id: labId },
        data: {
          name: input.name,
          description: input.description ?? null,
          timeZone: input.timeZone,
          slotDurationMinutes: input.slotDurationMinutes,
          bookingCapacity: input.bookingCapacity,
          quickVisitsEnabled: input.quickVisitsEnabled,
          quickVisitCapacity: input.quickVisitCapacity,
          bookingHorizonDays: input.bookingHorizonDays,
          cancellationWindowHours: input.cancellationWindowHours,
          maxFutureBookingsPerProject: input.maxFutureBookingsPerProject,
          projectVerificationRequired: true,
          teamLeaderAttendanceRequired: input.teamLeaderAttendanceRequired,
          configurationVersion: { increment: 1 },
        },
      });
      for (const row of input.weeklySchedule) {
        await tx.labSchedule.upsert({
          where: { labId_dayOfWeek: { labId, dayOfWeek: row.dayOfWeek } },
          update: {
            isOpen: row.isOpen,
            opensAtMinute: timeToMinute(row.opensAt),
            closesAtMinute: timeToMinute(row.closesAt),
          },
          create: {
            labId,
            dayOfWeek: row.dayOfWeek,
            isOpen: row.isOpen,
            opensAtMinute: timeToMinute(row.opensAt),
            closesAtMinute: timeToMinute(row.closesAt),
          },
        });
      }

      const updated = await loadLab(tx, labId);
      const today = localToday(updated.timeZone);
      const through = addLocalDays(today, updated.bookingHorizonDays);
      const exceptions = await loadExceptions(tx, labId, today, through);
      const generated = await reconcileRange(tx, updated, exceptions, today, through);
      await retireBeyondHorizon(tx, updated, through);
      const displayedExceptions = await loadExceptions(tx, labId, today, addLocalDays(today, 365));

      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "lab.configuration_changed",
          entityType: "Lab",
          entityId: labId,
          metadata: {
            before: configurationAuditSnapshot(existing),
            after: configurationAuditSnapshot(updated),
            generated,
          },
        },
      });

      return configurationDto(updated, displayedExceptions);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 20_000,
    },
  );
}

export async function upsertDateException(
  labId: string,
  input: DateExceptionInput,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await lockLab(tx, labId);
      const lab = await loadLab(tx, labId);
      const today = localToday(lab.timeZone);
      if (input.date < today) {
        throw new ApiError(409, "PAST_DATE_EXCEPTION", "Past operating dates cannot be changed");
      }
      const existing = await tx.labDateException.findUnique({
        where: { labId_localDate: { labId, localDate: localDateDbValue(input.date) } },
      });
      const exception = await tx.labDateException.upsert({
        where: { labId_localDate: { labId, localDate: localDateDbValue(input.date) } },
        update: {
          isClosed: input.isClosed,
          opensAtMinute: input.isClosed ? null : timeToMinute(input.opensAt!),
          closesAtMinute: input.isClosed ? null : timeToMinute(input.closesAt!),
          reason: input.reason,
        },
        create: {
          labId,
          localDate: localDateDbValue(input.date),
          isClosed: input.isClosed,
          opensAtMinute: input.isClosed ? null : timeToMinute(input.opensAt!),
          closesAtMinute: input.isClosed ? null : timeToMinute(input.closesAt!),
          reason: input.reason,
        },
      });

      let generated = { created: 0, updated: 0, closed: 0, deleted: 0 };
      if (input.date <= addLocalDays(today, lab.bookingHorizonDays)) {
        generated = await reconcileDate(tx, lab, [exception], input.date);
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: existing ? "lab.date_exception_changed" : "lab.date_exception_created",
          entityType: "LabDateException",
          entityId: exception.id,
          metadata: {
            labId,
            date: input.date,
            before: existing ? exceptionDto(existing) : null,
            after: exceptionDto(exception),
            generated,
          },
        },
      });
      return exceptionDto(exception);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deleteDateException(labId: string, exceptionId: string, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      await lockLab(tx, labId);
      const lab = await loadLab(tx, labId);
      const existing = await tx.labDateException.findFirst({ where: { id: exceptionId, labId } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Date exception not found");
      const date = dbDateToLocalDate(existing.localDate);
      await tx.labDateException.delete({ where: { id: exceptionId } });
      const today = localToday(lab.timeZone);
      const generated =
        date >= today && date <= addLocalDays(today, lab.bookingHorizonDays)
          ? await reconcileDate(tx, lab, [], date)
          : { created: 0, updated: 0, closed: 0, deleted: 0 };
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "lab.date_exception_deleted",
          entityType: "LabDateException",
          entityId: exceptionId,
          metadata: { labId, before: exceptionDto(existing), generated },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function regenerateSlots(
  labId: string,
  fromDate: string | undefined,
  toDate: string | undefined,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await lockLab(tx, labId);
      const lab = await loadLab(tx, labId);
      const today = localToday(lab.timeZone);
      const horizon = addLocalDays(today, lab.bookingHorizonDays);
      const from = fromDate ?? today;
      const to = toDate ?? horizon;
      if (from < today || to > horizon) {
        throw new ApiError(
          400,
          "OUTSIDE_GENERATION_WINDOW",
          `Slots can only be generated between ${today} and ${horizon}`,
        );
      }
      const exceptions = await loadExceptions(tx, labId, from, to);
      const result = await reconcileRange(tx, lab, exceptions, from, to);
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "lab.slots_regenerated",
          entityType: "Lab",
          entityId: labId,
          metadata: { fromDate: from, toDate: to, ...result },
        },
      });
      return { fromDate: from, toDate: to, ...result };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 },
  );
}

export async function availabilityDates(
  labId: string,
  projectId: string | undefined,
  participantCount: number,
  viewer: Viewer,
  now = new Date(),
) {
  const lab = await loadLab(prisma, labId);
  if (projectId) await loadVisibleProject(prisma, projectId, labId, viewer);
  const fromDate = localToday(lab.timeZone, now);
  const toDate = addLocalDays(fromDate, lab.bookingHorizonDays);
  const exceptions = await loadExceptions(prisma, labId, fromDate, toDate);
  return {
    lab: labSummary(lab),
    fromDate,
    toDate,
    participantCount,
    dates: enumerateLocalDates(fromDate, toDate).map((date) => {
      const policy = resolveDayPolicy(date, lab.schedules, exceptions);
      const slotCount = policy.isOpen
        ? buildSlotBlueprints(date, policy, lab.slotDurationMinutes, lab.timeZone).filter(
            (slot) => slot.startsAt > now,
          ).length
        : 0;
      const hasFutureSlots = policy.isOpen && slotCount > 0;
      return {
        date,
        label: dateLabel(date),
        isOpen: hasFutureSlots,
        opensAt: policy.opensAtMinute === null ? null : minuteToTime(policy.opensAtMinute),
        closesAt: policy.closesAtMinute === null ? null : minuteToTime(policy.closesAtMinute),
        slotCount,
        canFit: hasFutureSlots && participantCount <= lab.bookingCapacity,
        reason:
          policy.isOpen && !hasFutureSlots ? "No future slots remain for this date" : policy.reason,
        source: policy.source,
      };
    }),
  };
}

export async function dailyAvailability(
  labId: string,
  date: string,
  projectId: string | undefined,
  participantCount: number,
  viewer: Viewer,
) {
  const lab = await loadLab(prisma, labId);
  const fromDate = localToday(lab.timeZone);
  const toDate = addLocalDays(fromDate, lab.bookingHorizonDays);
  if (date < fromDate || date > toDate) {
    throw new ApiError(
      400,
      "OUTSIDE_BOOKING_HORIZON",
      `Choose a date between ${fromDate} and ${toDate}`,
    );
  }
  const project = projectId ? await loadVisibleProject(prisma, projectId, labId, viewer) : null;
  const exceptions = await loadExceptions(prisma, labId, date, date);
  const policy = resolveDayPolicy(date, lab.schedules, exceptions);
  if (await slotsNeedReconciliation(prisma, lab, date, policy)) {
    await prisma.$transaction(
      async (tx) => {
        await lockLab(tx, labId);
        const currentLab = await loadLab(tx, labId);
        const currentExceptions = await loadExceptions(tx, labId, date, date);
        const currentPolicy = resolveDayPolicy(date, currentLab.schedules, currentExceptions);
        if (await slotsNeedReconciliation(tx, currentLab, date, currentPolicy)) {
          await reconcileDate(tx, currentLab, currentExceptions, date);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
  const requestedAt = new Date();
  const slots = await prisma.labSlot.findMany({
    where: {
      labId,
      localDate: localDateDbValue(date),
      startsAt: { gt: requestedAt },
      status: SlotStatus.OPEN,
    },
    include: {
      bookings: {
        where: { status: { in: capacityBookingStatuses } },
        select: { attendeeCount: true },
      },
    },
    orderBy: { startsAt: "asc" },
  });
  const equipmentAdvisory =
    project?.equipmentRequirements.map(({ quantity, equipment }) => ({
      equipmentId: equipment.id,
      name: equipment.name,
      requiredQuantity: quantity,
      availableQuantity: equipment.availableQuantity,
      status: equipment.status,
      available:
        equipment.visible &&
        equipment.deletedAt === null &&
        !unavailableEquipmentStatuses.has(equipment.status) &&
        equipment.availableQuantity >= quantity,
    })) ?? [];
  const projectEligible = project
    ? project.creatorId === viewer.id && project.status === ProjectStatus.VERIFIED
    : null;

  return {
    lab: labSummary(lab),
    date,
    label: dateLabel(date),
    participantCount,
    policy: {
      isOpen: policy.isOpen,
      opensAt: policy.opensAtMinute === null ? null : minuteToTime(policy.opensAtMinute),
      closesAt: policy.closesAtMinute === null ? null : minuteToTime(policy.closesAtMinute),
      source: policy.source,
      reason: policy.reason,
    },
    project: project
      ? {
          id: project.id,
          title: project.title,
          status: project.status,
          eligibleForBooking: projectEligible,
          eligibilityMessage:
            project.creatorId !== viewer.id
              ? "Only the Team Leader can book for this project."
              : project.status !== ProjectStatus.VERIFIED
                ? "Faculty Mentor verification is required before booking."
                : "This project is eligible to continue to booking.",
        }
      : null,
    equipmentAdvisory,
    equipmentAdvisoryMessage:
      "Equipment status is advisory. MakerSpace places are governed only by attendee capacity.",
    slots: slots.map((slot) => {
      const placesUsed = slot.bookings.reduce((sum, booking) => sum + booking.attendeeCount, 0);
      const remainingCapacity = Math.max(0, slot.bookingCapacity - placesUsed);
      return {
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        startTime: formatTime(slot.startsAt, lab.timeZone),
        endTime: formatTime(slot.endsAt, lab.timeZone),
        bookingCapacity: slot.bookingCapacity,
        placesUsed,
        remainingCapacity,
        canFit: remainingCapacity >= participantCount,
        status: slot.status,
      };
    }),
  };
}

async function loadLab(client: DbClient, labId: string): Promise<PolicyLab> {
  const lab = await client.lab.findUnique({
    where: { id: labId },
    include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
  });
  if (!lab || !lab.isActive) throw new ApiError(404, "NOT_FOUND", "MakerSpace not found");
  return lab;
}

async function loadExceptions(client: DbClient, labId: string, fromDate: string, toDate: string) {
  return client.labDateException.findMany({
    where: {
      labId,
      localDate: { gte: localDateDbValue(fromDate), lte: localDateDbValue(toDate) },
    },
    orderBy: { localDate: "asc" },
    take: 366,
  });
}

async function loadVisibleProject(
  client: DbClient,
  projectId: string,
  labId: string,
  viewer: Viewer,
) {
  const project = await client.project.findFirst({
    where: { id: projectId, labId, deletedAt: null },
    include: {
      members: { select: { userId: true } },
      equipmentRequirements: { include: { equipment: true } },
    },
  });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  const canRead =
    project.creatorId === viewer.id ||
    project.currentMentorId === viewer.id ||
    project.members.some((member) => member.userId === viewer.id) ||
    hasPermission(viewer.roles, "project.read.any");
  if (!canRead) throw new ApiError(403, "FORBIDDEN", "You cannot view this project availability");
  return project;
}

async function slotsNeedReconciliation(
  client: DbClient,
  lab: PolicyLab,
  date: string,
  policy: ReturnType<typeof resolveDayPolicy>,
) {
  const desired = buildSlotBlueprints(date, policy, lab.slotDurationMinutes, lab.timeZone);
  const current = await client.labSlot.findMany({
    where: { labId: lab.id, localDate: localDateDbValue(date) },
    select: {
      startsAt: true,
      endsAt: true,
      bookingCapacity: true,
      quickVisitCapacity: true,
      policyVersion: true,
      status: true,
    },
  });
  const currentOpen = current.filter((slot) => slot.status === SlotStatus.OPEN);
  if (desired.length === 0) return currentOpen.length > 0;
  if (currentOpen.length !== desired.length) return true;
  const currentByStart = new Map(currentOpen.map((slot) => [slot.startsAt.toISOString(), slot]));
  return desired.some((slot) => {
    const saved = currentByStart.get(slot.startsAt.toISOString());
    return (
      !saved ||
      saved.endsAt.getTime() !== slot.endsAt.getTime() ||
      saved.bookingCapacity !== lab.bookingCapacity ||
      saved.quickVisitCapacity !== lab.quickVisitCapacity ||
      saved.policyVersion !== lab.configurationVersion ||
      saved.status !== SlotStatus.OPEN
    );
  });
}

async function lockLab(tx: Prisma.TransactionClient, labId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "labs" WHERE id = ${labId}::uuid FOR UPDATE
  `);
  if (rows.length !== 1) throw new ApiError(404, "NOT_FOUND", "MakerSpace not found");
}

async function assertFutureCapacityCompatible(
  tx: Prisma.TransactionClient,
  labId: string,
  proposedCapacity: number,
) {
  const now = new Date();
  await tx.$queryRaw(Prisma.sql`
    SELECT id
    FROM "lab_slots"
    WHERE "lab_id" = ${labId}::uuid AND "starts_at" > ${now}
    ORDER BY "starts_at", id
    FOR UPDATE
  `);
  const conflicts = await tx.$queryRaw<
    Array<{
      id: string;
      localDate: Date;
      startsAt: Date;
      reservedAttendees: number;
    }>
  >(Prisma.sql`
    SELECT
      slot.id,
      slot."local_date" AS "localDate",
      slot."starts_at" AS "startsAt",
      SUM(booking."attendee_count")::int AS "reservedAttendees"
    FROM "lab_slots" AS slot
    INNER JOIN "bookings" AS booking ON booking."lab_slot_id" = slot.id
    WHERE
      slot."lab_id" = ${labId}::uuid
      AND slot."starts_at" > ${now}
      AND booking.status IN ('CONFIRMED', 'ACTIVE')
    GROUP BY slot.id, slot."local_date", slot."starts_at"
    HAVING SUM(booking."attendee_count") > ${proposedCapacity}
    ORDER BY slot."starts_at", slot.id
    LIMIT 1
  `);
  const conflict = conflicts[0];
  if (!conflict) return;
  throw new ApiError(
    409,
    "CONFIGURATION_CAPACITY_CONFLICT",
    "The new capacity is below attendance already reserved for a future slot.",
    [
      {
        labSlotId: conflict.id,
        date: dbDateToLocalDate(conflict.localDate),
        startsAt: conflict.startsAt.toISOString(),
        reservedAttendees: conflict.reservedAttendees,
        proposedCapacity,
      },
    ],
  );
}

async function reconcileRange(
  tx: Prisma.TransactionClient,
  lab: PolicyLab,
  exceptions: DateException[],
  fromDate: string,
  toDate: string,
) {
  const desired = enumerateLocalDates(fromDate, toDate).flatMap((date) => {
    const policy = resolveDayPolicy(date, lab.schedules, exceptions);
    return buildSlotBlueprints(date, policy, lab.slotDurationMinutes, lab.timeZone);
  });
  const existing = await tx.labSlot.findMany({
    where: {
      labId: lab.id,
      localDate: {
        gte: localDateDbValue(fromDate),
        lte: localDateDbValue(toDate),
      },
    },
    include: { _count: { select: { bookings: true, quickVisits: true } } },
  });
  const desiredKeys = new Set(
    desired.map((slot) => `${slot.startsAt.toISOString()}:${slot.endsAt.toISOString()}`),
  );
  const existingByKey = new Map(
    existing.map((slot) => [`${slot.startsAt.toISOString()}:${slot.endsAt.toISOString()}`, slot]),
  );
  const missing = desired.filter(
    (slot) => !existingByKey.has(`${slot.startsAt.toISOString()}:${slot.endsAt.toISOString()}`),
  );
  const retainedIds = desired.flatMap((slot) => {
    const saved = existingByKey.get(`${slot.startsAt.toISOString()}:${slot.endsAt.toISOString()}`);
    return saved ? [saved.id] : [];
  });
  const removed = existing.filter(
    (slot) => !desiredKeys.has(`${slot.startsAt.toISOString()}:${slot.endsAt.toISOString()}`),
  );
  const closedIds = removed
    .filter((slot) => slot._count.bookings > 0 || slot._count.quickVisits > 0)
    .map((slot) => slot.id);
  const deletedIds = removed
    .filter((slot) => slot._count.bookings === 0 && slot._count.quickVisits === 0)
    .map((slot) => slot.id);

  if (missing.length) {
    await tx.labSlot.createMany({
      data: missing.map((slot) => ({
        labId: lab.id,
        localDate: localDateDbValue(slot.localDate),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        bookingCapacity: lab.bookingCapacity,
        quickVisitCapacity: lab.quickVisitCapacity,
        policyVersion: lab.configurationVersion,
        status: SlotStatus.OPEN,
      })),
      skipDuplicates: true,
    });
  }
  if (retainedIds.length) {
    await tx.labSlot.updateMany({
      where: { id: { in: retainedIds } },
      data: {
        bookingCapacity: lab.bookingCapacity,
        quickVisitCapacity: lab.quickVisitCapacity,
        policyVersion: lab.configurationVersion,
        status: SlotStatus.OPEN,
      },
    });
  }
  if (closedIds.length) {
    await tx.labSlot.updateMany({
      where: { id: { in: closedIds } },
      data: { status: SlotStatus.CLOSED },
    });
  }
  if (deletedIds.length) {
    await tx.labSlot.deleteMany({ where: { id: { in: deletedIds } } });
  }
  return {
    created: missing.length,
    updated: retainedIds.length,
    closed: closedIds.length,
    deleted: deletedIds.length,
  };
}

async function reconcileDate(
  tx: Prisma.TransactionClient,
  lab: PolicyLab,
  exceptions: DateException[],
  date: string,
) {
  const policy = resolveDayPolicy(date, lab.schedules, exceptions);
  const desired = buildSlotBlueprints(date, policy, lab.slotDurationMinutes, lab.timeZone);
  const existing = await tx.labSlot.findMany({
    where: { labId: lab.id, localDate: localDateDbValue(date) },
    include: { _count: { select: { bookings: true, quickVisits: true } } },
  });
  const existingKeys = new Set(existing.map((slot) => slot.startsAt.toISOString()));
  const desiredKeys = new Set(desired.map((slot) => slot.startsAt.toISOString()));
  const result = { created: 0, updated: 0, closed: 0, deleted: 0 };

  for (const slot of desired) {
    await tx.labSlot.upsert({
      where: {
        labId_startsAt_endsAt: { labId: lab.id, startsAt: slot.startsAt, endsAt: slot.endsAt },
      },
      update: {
        localDate: localDateDbValue(date),
        bookingCapacity: lab.bookingCapacity,
        quickVisitCapacity: lab.quickVisitCapacity,
        policyVersion: lab.configurationVersion,
        status: SlotStatus.OPEN,
      },
      create: {
        labId: lab.id,
        localDate: localDateDbValue(date),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        bookingCapacity: lab.bookingCapacity,
        quickVisitCapacity: lab.quickVisitCapacity,
        policyVersion: lab.configurationVersion,
        status: SlotStatus.OPEN,
      },
    });
    if (existingKeys.has(slot.startsAt.toISOString())) result.updated += 1;
    else result.created += 1;
  }

  for (const slot of existing.filter(
    (candidate) => !desiredKeys.has(candidate.startsAt.toISOString()),
  )) {
    if (slot._count.bookings > 0 || slot._count.quickVisits > 0) {
      await tx.labSlot.update({ where: { id: slot.id }, data: { status: SlotStatus.CLOSED } });
      result.closed += 1;
    } else {
      await tx.labSlot.delete({ where: { id: slot.id } });
      result.deleted += 1;
    }
  }
  return result;
}

async function retireBeyondHorizon(
  tx: Prisma.TransactionClient,
  lab: PolicyLab,
  lastBookableDate: string,
) {
  const outside = {
    labId: lab.id,
    localDate: { gt: localDateDbValue(lastBookableDate) },
  };
  await tx.labSlot.deleteMany({
    where: { ...outside, bookings: { none: {} }, quickVisits: { none: {} } },
  });
  await tx.labSlot.updateMany({ where: outside, data: { status: SlotStatus.CLOSED } });
}

function configurationDto(lab: PolicyLab, exceptions: DateException[]) {
  const today = localToday(lab.timeZone);
  return {
    id: lab.id,
    code: lab.code,
    name: lab.name,
    description: lab.description,
    timeZone: lab.timeZone,
    slotDurationMinutes: lab.slotDurationMinutes,
    bookingCapacity: lab.bookingCapacity,
    quickVisitsEnabled: lab.quickVisitsEnabled,
    quickVisitCapacity: lab.quickVisitCapacity,
    bookingHorizonDays: lab.bookingHorizonDays,
    cancellationWindowHours: lab.cancellationWindowHours,
    maxFutureBookingsPerProject: lab.maxFutureBookingsPerProject,
    projectVerificationRequired: lab.projectVerificationRequired,
    teamLeaderAttendanceRequired: lab.teamLeaderAttendanceRequired,
    configurationVersion: lab.configurationVersion,
    updatedAt: lab.updatedAt.toISOString(),
    bookingWindow: { fromDate: today, toDate: addLocalDays(today, lab.bookingHorizonDays) },
    weeklySchedule: lab.schedules.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      isOpen: row.isOpen,
      opensAt: minuteToTime(row.opensAtMinute),
      closesAt: minuteToTime(row.closesAtMinute),
    })),
    dateExceptions: exceptions.map(exceptionDto),
  };
}

function exceptionDto(exception: DateException & { id?: string; updatedAt?: Date }) {
  return {
    id: exception.id,
    date: dbDateToLocalDate(exception.localDate),
    isClosed: exception.isClosed,
    opensAt: exception.opensAtMinute === null ? null : minuteToTime(exception.opensAtMinute),
    closesAt: exception.closesAtMinute === null ? null : minuteToTime(exception.closesAtMinute),
    reason: exception.reason,
    updatedAt: exception.updatedAt?.toISOString(),
  };
}

function labSummary(lab: PolicyLab) {
  return {
    id: lab.id,
    code: lab.code,
    name: lab.name,
    timeZone: lab.timeZone,
    slotDurationMinutes: lab.slotDurationMinutes,
    bookingCapacity: lab.bookingCapacity,
    bookingHorizonDays: lab.bookingHorizonDays,
    teamLeaderAttendanceRequired: lab.teamLeaderAttendanceRequired,
  };
}

function configurationAuditSnapshot(lab: PolicyLab) {
  return {
    name: lab.name,
    timeZone: lab.timeZone,
    slotDurationMinutes: lab.slotDurationMinutes,
    bookingCapacity: lab.bookingCapacity,
    quickVisitsEnabled: lab.quickVisitsEnabled,
    quickVisitCapacity: lab.quickVisitCapacity,
    bookingHorizonDays: lab.bookingHorizonDays,
    cancellationWindowHours: lab.cancellationWindowHours,
    maxFutureBookingsPerProject: lab.maxFutureBookingsPerProject,
    projectVerificationRequired: lab.projectVerificationRequired,
    teamLeaderAttendanceRequired: lab.teamLeaderAttendanceRequired,
    configurationVersion: lab.configurationVersion,
    weeklySchedule: lab.schedules,
  };
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(localDateDbValue(date));
}

function formatTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(value);
}
