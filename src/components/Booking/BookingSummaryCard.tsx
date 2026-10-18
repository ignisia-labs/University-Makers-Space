import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock3, Users } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingDto } from "@/lib/api";
import { bookingShortDate, bookingStatusLabel, bookingTimeRange } from "@/lib/booking-format";

export function BookingSummaryCard({ booking }: { booking: BookingDto }) {
  const participants = booking.participants.map((participant) => participant.name);

  return (
    <article className="card-surface overflow-hidden">
      <div className="border-b border-border bg-secondary/45 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-primary">
              {booking.labName}
            </p>
            <h3 className="mt-2 truncate font-serif text-xl font-light sm:text-2xl">
              {booking.projectTitle}
            </h3>
          </div>
          <StatusBadge label={bookingStatusLabel(booking)} />
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-3 sm:px-6">
        <Fact icon={CalendarDays} label="Date" value={bookingShortDate(booking)} />
        <Fact icon={Clock3} label="Time" value={bookingTimeRange(booking)} />
        <Fact
          icon={Users}
          label="Attending"
          value={`${booking.attendeeCount} ${booking.attendeeCount === 1 ? "person" : "people"}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {participants.length
            ? participants.slice(0, 3).join(", ") +
              (participants.length > 3 ? ` +${participants.length - 3}` : "")
            : "Participant details unavailable"}
        </p>
        <Link
          to="/bookings/$bookingId"
          params={{ bookingId: booking.id }}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-primary"
        >
          View details <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/7 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
