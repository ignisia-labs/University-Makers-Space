import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock3, FolderKanban, MapPin, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, bookingsApi } from "@/lib/api";
import {
  bookingDateLabel,
  bookingMomentLabel,
  bookingStatusLabel,
  bookingTimeRange,
} from "@/lib/booking-format";
import { invalidateBookingData, usePersistedBooking } from "@/lib/booking-queries";

export function PersistedBookingDetail({ bookingId }: { bookingId: string }) {
  const booking = usePersistedBooking(bookingId);
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () =>
      bookingsApi.cancel(bookingId, {
        reason: reason.trim(),
        idempotencyKey,
      }),
    onSuccess: async ({ data }) => {
      await invalidateBookingData(queryClient, data.id, data.projectId);
      setCancelOpen(false);
      setReason("");
      setIdempotencyKey("");
      toast.success("Booking cancelled and capacity released");
    },
  });

  if (booking.isLoading) {
    return (
      <AppShell title="Booking details" subtitle="Loading your MakerSpace session">
        <div className="mx-auto max-w-4xl space-y-4" aria-label="Loading booking details">
          <div className="h-48 animate-pulse rounded-2xl bg-primary/10" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </AppShell>
    );
  }

  if (booking.isError || !booking.data) {
    return (
      <AppShell title="Booking unavailable" subtitle="Your MakerSpace session">
        <div className="mx-auto max-w-xl">
          <section className="card-surface px-6 py-12 text-center">
            <h2 className="font-serif text-2xl font-light">This booking could not be loaded</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It may no longer be accessible, or the connection was interrupted.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => booking.refetch()}
                className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Try again
              </button>
              <Link
                to="/book"
                className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary"
              >
                Back to Slots
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  const row = booking.data;
  const cancellationError = cancelMutation.error;
  return (
    <AppShell title="Booking details" subtitle={row.projectTitle}>
      <div className="mx-auto max-w-4xl">
        <Link
          to="/book"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to Slots
        </Link>

        <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary text-primary-foreground shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/65">
                  MakerSpace booking
                </p>
                <h1 className="mt-3 font-serif text-3xl font-light sm:text-4xl">
                  {row.projectTitle}
                </h1>
                <p className="mt-2 text-sm text-white/70">{row.labName}</p>
              </div>
              <StatusBadge
                label={bookingStatusLabel(row)}
                className="border-white/20 bg-white/10 text-white"
              />
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <HeroFact icon={CalendarDays} label="Date" value={bookingDateLabel(row)} />
              <HeroFact icon={Clock3} label="Time" value={bookingTimeRange(row)} />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <section className="card-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" aria-hidden /> Team attending
              </h2>
              <span className="text-xs text-muted-foreground">{row.attendeeCount} people</span>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {row.participants.map((participant) => (
                <li key={participant.userId} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/7 text-xs font-bold text-primary">
                    {initials(participant.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{participant.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {participant.role === "LEADER" ? "Team Leader" : "Project member"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-4">
            <section className="card-surface p-5">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-primary">
                Booking context
              </h2>
              <div className="mt-4 space-y-4">
                <DetailFact icon={FolderKanban} label="Project" value={row.projectTitle} />
                <DetailFact icon={MapPin} label="Location" value={row.labName} />
                <DetailFact icon={Clock3} label="Time zone" value={row.timeZone} />
              </div>
              <Link
                to="/projects/$projectId"
                params={{ projectId: row.projectId }}
                className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
              >
                Open project
              </Link>
            </section>

            {row.notes && (
              <section className="card-surface p-5">
                <h2 className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  Visit note
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{row.notes}</p>
              </section>
            )}
          </aside>
        </div>

        {row.status === "CANCELLED" && (
          <section className="mt-6 rounded-2xl border border-border bg-muted/60 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Cancellation record</h2>
              <StatusBadge label={bookingStatusLabel(row)} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {row.cancellationReason ?? "No cancellation reason was recorded."}
            </p>
            {row.cancelledAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Recorded {bookingMomentLabel(row.cancelledAt, row.timeZone)}
              </p>
            )}
          </section>
        )}

        {row.canCancel && (
          <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <div>
              <p className="text-sm font-semibold">Plans changed?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cancelling releases all {row.attendeeCount} reserved places.
                {row.cancellationDeadline
                  ? ` Available until ${bookingMomentLabel(row.cancellationDeadline, row.timeZone)}.`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReason("");
                if (!idempotencyKey) setIdempotencyKey(crypto.randomUUID());
                cancelMutation.reset();
                setCancelOpen(true);
              }}
              className="min-h-11 rounded-xl border border-destructive/35 px-5 text-sm font-semibold text-destructive hover:bg-destructive/5"
            >
              Cancel booking
            </button>
          </section>
        )}
      </div>

      <ResponsiveModal
        open={cancelOpen}
        onOpenChange={(open) => !cancelMutation.isPending && setCancelOpen(open)}
        title="Cancel this booking?"
        description={`This releases ${row.attendeeCount} MakerSpace ${row.attendeeCount === 1 ? "place" : "places"} and keeps the booking in your history.`}
      >
        <label className="block text-sm font-medium" htmlFor="booking-cancellation-reason">
          Reason for cancellation
          <textarea
            id="booking-cancellation-reason"
            value={reason}
            minLength={3}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              if (cancelMutation.isError) {
                setIdempotencyKey(crypto.randomUUID());
                cancelMutation.reset();
              }
            }}
            placeholder="Briefly tell the MakerSpace team why"
            className="form-input mt-2 min-h-24 resize-none py-3"
          />
        </label>
        {cancellationError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {cancellationError instanceof ApiError
              ? cancellationError.message
              : "The booking could not be cancelled. Check your connection and try again."}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={cancelMutation.isPending}
            onClick={() => setCancelOpen(false)}
            className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            Keep booking
          </button>
          <button
            type="button"
            disabled={cancelMutation.isPending || reason.trim().length < 3}
            onClick={() => cancelMutation.mutate()}
            className="min-h-12 flex-1 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel booking"}
          </button>
        </div>
      </ResponsiveModal>
    </AppShell>
  );
}

function HeroFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3">
      <Icon className="size-5 shrink-0 text-white/70" aria-hidden />
      <div>
        <p className="text-[9px] font-mono uppercase tracking-wider text-white/55">{label}</p>
        <p className="mt-0.5 text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function DetailFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderKanban;
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
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
