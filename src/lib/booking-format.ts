import type { BookingDto } from "./api";

const fallbackTimeZone = "Asia/Kolkata";

function safeTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return fallbackTimeZone;
  }
}

export function bookingDateLabel(booking: Pick<BookingDto, "startsAt" | "timeZone">) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: safeTimeZone(booking.timeZone),
  }).format(new Date(booking.startsAt));
}

export function bookingShortDate(booking: Pick<BookingDto, "startsAt" | "timeZone">) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: safeTimeZone(booking.timeZone),
  }).format(new Date(booking.startsAt));
}

export function bookingTimeRange(booking: Pick<BookingDto, "startsAt" | "endsAt" | "timeZone">) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: safeTimeZone(booking.timeZone),
  });
  return `${formatter.format(new Date(booking.startsAt))}–${formatter.format(new Date(booking.endsAt))}`;
}

export function bookingMomentLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: safeTimeZone(timeZone),
  }).format(new Date(value));
}

export function bookingStatusLabel(booking: Pick<BookingDto, "status" | "statusLabel">) {
  if (booking.statusLabel) return booking.statusLabel;
  const labels: Record<BookingDto["status"], string> = {
    CONFIRMED: "Confirmed",
    ACTIVE: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No Show",
  };
  return labels[booking.status];
}
