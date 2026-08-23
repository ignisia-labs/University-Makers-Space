export type WeeklySchedule = {
  dayOfWeek: number;
  isOpen: boolean;
  opensAtMinute: number;
  closesAtMinute: number;
};

export type DateException = {
  localDate: Date;
  isClosed: boolean;
  opensAtMinute: number | null;
  closesAtMinute: number | null;
  reason: string;
};

export type DayPolicy = {
  isOpen: boolean;
  opensAtMinute: number | null;
  closesAtMinute: number | null;
  source: "WEEKLY_SCHEDULE" | "DATE_EXCEPTION";
  reason: string | null;
};

export type SlotBlueprint = {
  localDate: string;
  startsAt: Date;
  endsAt: Date;
  startTime: string;
  endTime: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function localDateDbValue(value: string) {
  if (!isValidLocalDate(value)) throw new Error(`Invalid local date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function dbDateToLocalDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addLocalDays(value: string, days: number) {
  const date = localDateDbValue(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function enumerateLocalDates(fromDate: string, toDate: string) {
  if (!isValidLocalDate(fromDate) || !isValidLocalDate(toDate) || fromDate > toDate) {
    throw new Error("Invalid local date range");
  }
  const dates: string[] = [];
  for (let cursor = fromDate; cursor <= toDate; cursor = addLocalDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function localToday(timeZone: string, now = new Date()) {
  const parts = zonedParts(now, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function dayOfWeek(localDate: string) {
  return localDateDbValue(localDate).getUTCDay();
}

export function minuteToTime(minute: number) {
  const normalized = minute === 1440 ? 0 : minute;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function timeToMinute(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

export function resolveDayPolicy(
  localDate: string,
  schedules: WeeklySchedule[],
  exceptions: DateException[],
): DayPolicy {
  const exception = exceptions.find(
    (candidate) => dbDateToLocalDate(candidate.localDate) === localDate,
  );
  if (exception) {
    if (exception.isClosed) {
      return {
        isOpen: false,
        opensAtMinute: null,
        closesAtMinute: null,
        source: "DATE_EXCEPTION",
        reason: exception.reason,
      };
    }
    return {
      isOpen: true,
      opensAtMinute: exception.opensAtMinute,
      closesAtMinute: exception.closesAtMinute,
      source: "DATE_EXCEPTION",
      reason: exception.reason,
    };
  }

  const schedule = schedules.find((candidate) => candidate.dayOfWeek === dayOfWeek(localDate));
  if (!schedule?.isOpen) {
    return {
      isOpen: false,
      opensAtMinute: null,
      closesAtMinute: null,
      source: "WEEKLY_SCHEDULE",
      reason: "Closed on this day",
    };
  }
  return {
    isOpen: true,
    opensAtMinute: schedule.opensAtMinute,
    closesAtMinute: schedule.closesAtMinute,
    source: "WEEKLY_SCHEDULE",
    reason: null,
  };
}

export function buildSlotBlueprints(
  localDate: string,
  policy: DayPolicy,
  slotDurationMinutes: number,
  timeZone: string,
) {
  if (!policy.isOpen || policy.opensAtMinute === null || policy.closesAtMinute === null) {
    return [];
  }
  const slots: SlotBlueprint[] = [];
  for (
    let startsAtMinute = policy.opensAtMinute;
    startsAtMinute + slotDurationMinutes <= policy.closesAtMinute;
    startsAtMinute += slotDurationMinutes
  ) {
    const endsAtMinute = startsAtMinute + slotDurationMinutes;
    slots.push({
      localDate,
      startsAt: zonedLocalMinuteToUtc(localDate, startsAtMinute, timeZone),
      endsAt: zonedLocalMinuteToUtc(localDate, endsAtMinute, timeZone),
      startTime: minuteToTime(startsAtMinute),
      endTime: minuteToTime(endsAtMinute),
    });
  }
  return slots;
}

export function zonedLocalMinuteToUtc(localDate: string, minuteOfDay: number, timeZone: string) {
  const normalizedDate = minuteOfDay === 1440 ? addLocalDays(localDate, 1) : localDate;
  const normalizedMinute = minuteOfDay === 1440 ? 0 : minuteOfDay;
  const [year, month, day] = normalizedDate.split("-").map(Number);
  const hour = Math.floor(normalizedMinute / 60);
  const minute = normalizedMinute % 60;
  const targetAsUtc = Date.UTC(year!, month! - 1, day!, hour, minute, 0, 0);
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
      0,
    );
    const correction = targetAsUtc - actualAsUtc;
    if (correction === 0) break;
    candidate += correction;
  }

  const result = new Date(candidate);
  const verified = zonedParts(result, timeZone);
  if (
    verified.year !== year ||
    verified.month !== month ||
    verified.day !== day ||
    verified.hour !== hour ||
    verified.minute !== minute
  ) {
    throw new Error(
      `Local time ${normalizedDate} ${minuteToTime(normalizedMinute)} does not exist`,
    );
  }
  return result;
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
}
