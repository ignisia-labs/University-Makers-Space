import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, DoorOpen, Footprints, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ApiError,
  bookingsApi,
  consoleApi,
  consumableClaimsApi,
  equipmentApi,
  quickVisitsApi,
  readableError,
  referenceApi,
  visitsApi,
  type ConsoleBooking,
  type ConsoleDto,
  type ConsoleParticipant,
  type BookingDto,
  type ConsoleQuickVisit,
  type EquipmentDto,
  type EquipmentStatusValue,
  uploadsApi,
} from "@/lib/api";
import { EquipmentManager } from "@/components/Equipment/EquipmentManager";
import { DomainManager } from "@/components/Equipment/DomainManager";
import { ConsumableManager } from "@/components/Equipment/ConsumableManager";
import { cn } from "@/lib/utils";

export type OperationsWorkspace = "sessions" | "visits" | "materials" | "equipment" | "catalogue";

const equipmentStatuses: EquipmentStatusValue[] = [
  "AVAILABLE",
  "PARTIALLY_AVAILABLE",
  "IN_USE",
  "UNAVAILABLE",
  "UNDER_MAINTENANCE",
  "DAMAGED",
  "OUT_OF_SERVICE",
];

/**
 * The Lab Assistant's desk.
 *
 * Everything here is about the room as it is right now, so the roster is
 * refetched on a short interval and after every action: two assistants working
 * the same door must not disagree about who is inside.
 */
export function LiveConsole({ workspace }: { workspace: OperationsWorkspace }) {
  const labs = useQuery({
    queryKey: ["reference-labs"],
    queryFn: () => referenceApi.labs().then((response) => response.data),
    staleTime: 300_000,
  });
  const labId = labs.data?.[0]?.id ?? null;

  // Which day the desk is looking at. Defaults to today, but a session booked
  // for tomorrow must be reachable — an assistant closing up at 19:00 was
  // otherwise shown an empty desk with no hint that tomorrow is busy.
  const [date, setDate] = useState<string | null>(null);
  const timeZone = labs.data?.[0]?.timeZone ?? "Asia/Kolkata";
  const today = todayIn(timeZone);
  const activeDate = date ?? today;

  // Which days have sessions, so the strip can mark them.
  const upcoming = useQuery({
    queryKey: ["console-upcoming-bookings", labId],
    queryFn: () =>
      bookingsApi.list({ scope: "upcoming", limit: "50" }).then((response) => response.data),
    staleTime: 30_000,
  });

  const roster = useQuery({
    queryKey: ["console-roster", labId, activeDate],
    queryFn: () => consoleApi.roster(labId!, activeDate).then((response) => response.data),
    enabled: Boolean(labId),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  if (labs.isPending || roster.isPending) {
    return <div className="card-surface h-72 animate-pulse bg-muted/40" aria-busy="true" />;
  }
  if (!labId) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        No MakerSpace is configured yet.
      </div>
    );
  }
  if (roster.isError || !roster.data) {
    return (
      <div className="card-surface px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">
          {readableError(roster.error, "The console could not be loaded.")}
        </p>
        <button
          type="button"
          onClick={() => void roster.refetch()}
          className="pressable mt-5 min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
        >
          Try again
        </button>
      </div>
    );
  }

  const data = roster.data;
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-3xl duration-500">
      <section
        aria-label="Lab at a glance"
        className="card-surface flex items-stretch divide-x divide-border px-2 py-4"
      >
        {[
          { label: "Booked sessions", value: String(countLiveBookings(data)) },
          { label: "In the lab", value: String(data.occupancy.current) },
          { label: "Open visits", value: String(countOpenQuickVisits(data)) },
          { label: "Awaiting approval", value: String(data.pendingQuickVisitRequests) },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 px-2 text-center sm:px-5">
            <p className="font-serif text-2xl font-light text-foreground sm:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {(workspace === "sessions" || workspace === "visits") && (
        <DayPicker
          value={activeDate}
          today={today}
          onChange={setDate}
          busyDays={
            new Set(
              (upcoming.data ?? []).map((booking) =>
                localDayOf(booking.startsAt, booking.timeZone),
              ),
            )
          }
        />
      )}

      <div className="mt-8">
        {workspace === "sessions" && (
          <SessionsDesk data={data} labId={labId} date={activeDate} onPickDate={setDate} />
        )}
        {workspace === "visits" && <VisitsDesk data={data} labId={labId} date={activeDate} />}
        {workspace === "materials" && <MaterialsDesk />}
        {workspace === "equipment" && <EquipmentManager labId={labId} />}
        {workspace === "catalogue" && (
          <div className="space-y-8">
            <DomainManager labId={labId} />
            <ConsumableManager labId={labId} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Day navigation for the desk.
 *
 * The same strip of date tiles a student books from — the two roles are looking
 * at the same calendar, and an assistant tracking a session should not have to
 * translate between two different pictures of it.
 */
function DayPicker({
  value,
  today,
  onChange,
  busyDays,
}: {
  value: string;
  today: string;
  onChange: (date: string) => void;
  /** Days with at least one live booking, so the desk can see where the work is. */
  busyDays: Set<string>;
}) {
  // A fortnight from today, plus a week behind for looking back at a session.
  const days = useMemo(() => {
    const out: string[] = [];
    for (let offset = -7; offset <= 14; offset += 1) out.push(shiftDate(today, offset));
    return out;
  }, [today]);

  return (
    <section className="card-surface mt-6 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-primary">Date</h2>
        {value !== today && (
          <button
            type="button"
            onClick={() => onChange(today)}
            className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-primary"
          >
            Back to today
          </button>
        )}
      </div>
      <ul className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
        {days.map((date) => {
          const parsed = parseLocalDate(date);
          const active = date === value;
          return (
            <li key={date} className="snap-start">
              <button
                type="button"
                aria-pressed={active}
                aria-current={date === today ? "date" : undefined}
                onClick={() => onChange(date)}
                className={cn(
                  "relative flex min-h-20 w-[4.5rem] flex-col items-center justify-center rounded-2xl border transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40",
                  date === today && !active && "border-primary/50",
                )}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                  {parsed.day}
                </span>
                <span className="font-serif text-2xl font-light">{parsed.date}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                  {parsed.month}
                </span>
                {busyDays.has(date) && (
                  <span
                    className={cn(
                      "absolute bottom-1.5 size-1.5 rounded-full",
                      active ? "bg-primary-foreground" : "bg-primary",
                    )}
                    aria-label="has sessions"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function parseLocalDate(value: string) {
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, dayOfMonth!));
  return {
    day: parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    date: String(dayOfMonth).padStart(2, "0"),
    month: parsed.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
  };
}

/* ── Sessions: entry desk + full slot history, date-wise ──────── */

function SessionsDesk({
  data,
  labId,
  date,
  onPickDate,
}: {
  data: ConsoleDto;
  labId: string;
  date: string;
  onPickDate: (date: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [action, setAction] = useState<{
    kind: "cancel" | "noshow";
    booking: ConsoleBooking;
  } | null>(null);
  const [reason, setReason] = useState("");

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["console-roster", labId, date] });

  // Today's roster carries the live sessions; anything already finished or
  // cancelled is fetched separately so "Past" is not limited to today.
  // What is booked beyond this day. An empty desk must be able to say "nothing
  // today — three sessions tomorrow", because "nothing here" on its own reads
  // as "nothing is booked", which is how a booked slot appears to go missing.
  const upcomingElsewhere = useQuery({
    queryKey: ["console-upcoming-bookings", labId],
    queryFn: () =>
      bookingsApi.list({ scope: "upcoming", limit: "50" }).then((response) => response.data),
    staleTime: 30_000,
  });

  const past = useQuery({
    queryKey: ["console-past-bookings", labId],
    queryFn: () =>
      bookingsApi.list({ scope: "past", limit: "50" }).then((response) => response.data),
    enabled: tab === "past",
    staleTime: 30_000,
  });

  const liveSlots = data.slots.filter((slot) =>
    slot.bookings.some((booking) => booking.status === "CONFIRMED" || booking.status === "ACTIVE"),
  );
  const upcomingCount = liveSlots.reduce(
    (sum, slot) =>
      sum +
      slot.bookings.filter(
        (booking) => booking.status === "CONFIRMED" || booking.status === "ACTIVE",
      ).length,
    0,
  );

  const decide = useMutation({
    mutationFn: (input: { kind: "cancel" | "noshow"; bookingId: string; reason: string }) =>
      input.kind === "cancel"
        ? bookingsApi.cancel(input.bookingId, {
            reason: input.reason,
            idempotencyKey: crypto.randomUUID(),
          })
        : bookingsApi.updateStatus(input.bookingId, "NO_SHOW", input.reason),
    onSuccess: async (_result, input) => {
      await refresh();
      setAction(null);
      setReason("");
      toast.success(input.kind === "cancel" ? "Session cancelled" : "Marked no-show");
    },
    onError: (error) => toast.error(readableError(error, "That change could not be saved")),
  });

  return (
    <div>
      <div
        role="tablist"
        aria-label="Session views"
        className="inline-flex rounded-full border border-border bg-card p-1"
      >
        {(
          [
            { id: "upcoming", label: `Upcoming (${upcomingCount})` },
            { id: "past", label: "Past" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-wider transition-colors",
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {tab === "upcoming" ? (
          liveSlots.length ? (
            liveSlots.map((slot) => {
              const live = slot.bookings.filter(
                (booking) => booking.status === "CONFIRMED" || booking.status === "ACTIVE",
              );
              return (
                <section key={slot.id}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <h2 className="font-serif text-xl font-light tracking-wide">
                      {clock(slot.startsAt, data.lab.timeZone)} –{" "}
                      {clock(slot.endsAt, data.lab.timeZone)}
                    </h2>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {live.length} {live.length === 1 ? "session" : "sessions"}
                      {slot.isCurrent && " · now"}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {live.map((booking) => (
                      <EntryCard
                        key={booking.id}
                        booking={booking}
                        slotLabel={`${clock(slot.startsAt, data.lab.timeZone)} – ${clock(slot.endsAt, data.lab.timeZone)}`}
                        onChanged={refresh}
                        onCancel={() => {
                          setAction({ kind: "cancel", booking });
                          setReason("");
                        }}
                        onNoShow={() => {
                          setAction({ kind: "noshow", booking });
                          setReason("");
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <EmptyDay date={date} bookings={upcomingElsewhere.data ?? []} onPickDate={onPickDate} />
          )
        ) : past.isPending ? (
          <div className="card-surface h-40 animate-pulse bg-muted/40" aria-busy="true" />
        ) : past.data?.length ? (
          <div className="space-y-4">
            {past.data.map((booking) => (
              <article
                key={booking.id}
                className="card-surface flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{booking.projectTitle}</p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {longDate(booking.startsAt, booking.timeZone)} ·{" "}
                    {clock(booking.startsAt, booking.timeZone)} –{" "}
                    {clock(booking.endsAt, booking.timeZone)} · {booking.attendeeCount}{" "}
                    {booking.attendeeCount === 1 ? "attendee" : "attendees"}
                    {booking.equipment.length > 0 &&
                      ` · ${booking.equipment.map((item) => item.name).join(", ")}`}
                  </p>
                  {booking.cancellationReason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {booking.cancellationReason}
                    </p>
                  )}
                </div>
                <StatusBadge label={booking.statusLabel} className="shrink-0" />
              </article>
            ))}
          </div>
        ) : (
          <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
            Completed and cancelled sessions will collect here.
          </div>
        )}
      </div>

      <ResponsiveModal
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.kind === "cancel" ? "Cancel this session?" : "Mark as no-show?"}
        description={
          action?.kind === "cancel"
            ? "The reserved seats and machines are released and the team is notified."
            : "Use when the team did not arrive during the attendance window."
        }
      >
        <label className="block text-sm font-medium">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Briefly note why"
            className="form-input mt-2 min-h-24 resize-none py-3"
          />
        </label>
        <button
          type="button"
          disabled={!reason.trim() || decide.isPending}
          onClick={() =>
            action &&
            decide.mutate({
              kind: action.kind,
              bookingId: action.booking.id,
              reason: reason.trim(),
            })
          }
          className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          {decide.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Confirm
        </button>
      </ResponsiveModal>
    </div>
  );
}

/**
 * Nothing booked on the chosen day.
 *
 * If other days *are* booked, name the nearest one and offer a single tap to
 * reach it. A bare "no sessions" is what makes a booked slot look lost.
 */
function EmptyDay({
  date,
  bookings,
  onPickDate,
}: {
  date: string;
  bookings: BookingDto[];
  onPickDate: (date: string) => void;
}) {
  const elsewhere = bookings
    .map((booking) => ({ booking, day: localDayOf(booking.startsAt, booking.timeZone) }))
    .filter((entry) => entry.day !== date)
    .sort((a, b) => a.day.localeCompare(b.day));
  const next = elsewhere[0];
  const sameDay = next ? elsewhere.filter((entry) => entry.day === next.day).length : 0;

  return (
    <div className="card-surface px-6 py-14 text-center">
      <p className="text-sm text-muted-foreground">
        No sessions are booked for {longDateFromLocal(date)}.
      </p>
      {next && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            The next is on {longDateFromLocal(next.day)} — {sameDay}{" "}
            {sameDay === 1 ? "session" : "sessions"}.
          </p>
          <button
            type="button"
            onClick={() => onPickDate(next.day)}
            className="pressable mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Go to {longDateFromLocal(next.day)}
          </button>
        </>
      )}
    </div>
  );
}

function EntryCard({
  booking,
  slotLabel,
  onChanged,
  onCancel,
  onNoShow,
}: {
  booking: ConsoleBooking;
  slotLabel: string;
  onChanged: () => Promise<void> | void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const mark = async (participant: ConsoleParticipant, direction: "in" | "out") => {
    setBusyUser(participant.userId);
    try {
      if (direction === "in") {
        await visitsApi.checkIn({
          source: "BOOKING",
          bookingId: booking.id,
          userId: participant.userId,
          idempotencyKey: crypto.randomUUID(),
        });
        toast.success("Entry permitted");
      } else if (participant.visitId) {
        await visitsApi.checkOut(participant.visitId, { idempotencyKey: crypto.randomUUID() });
        toast.success("Exit recorded");
      }
      await onChanged();
    } catch (error) {
      toast.error(readableError(error, "That could not be recorded"));
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg font-light tracking-wide">
            {booking.projectTitle}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <DoorOpen className="size-3" /> {slotLabel}
            {booking.presentCount > 0 && (
              <span className="text-primary">· {booking.presentCount} in the lab</span>
            )}
          </p>
        </div>
        <StatusBadge label={booking.status === "ACTIVE" ? "In Progress" : "Confirmed"} />
      </div>

      <ul className="divide-y divide-border/60 px-5">
        {booking.participants.map((participant) => {
          const busy = busyUser === participant.userId;
          const inside = participant.attendanceStatus === "CHECKED_IN";
          const left = participant.attendanceStatus === "CHECKED_OUT";
          return (
            <li
              key={participant.userId}
              className="flex min-h-12 items-center justify-between gap-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    inside
                      ? "bg-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                      : left
                        ? "bg-primary/50"
                        : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{participant.name}</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {inside
                      ? `In since ${participant.checkedInAt ? shortClock(participant.checkedInAt) : ""}`
                      : left
                        ? `Out at ${participant.checkedOutAt ? shortClock(participant.checkedOutAt) : ""}`
                        : "Expected"}
                    {participant.isLateArrival && ` · ${participant.lateByMinutes}m late`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {busy && <Loader2 className="size-4 animate-spin text-primary" aria-hidden />}
                {participant.canCheckIn && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void mark(participant, "in")}
                    className="pressable min-h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Permit entry
                  </button>
                )}
                {participant.canCheckOut && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void mark(participant, "out")}
                    className="pressable min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    Mark exit
                  </button>
                )}
                {left && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Done
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onNoShow}
          className="pressable min-h-10 rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          No-show
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="pressable min-h-10 rounded-xl border border-destructive/40 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
        >
          Cancel session
        </button>
      </div>
    </section>
  );
}

/* ── Visits: permit and close quick visits ────────────────────── */

function VisitsDesk({ data, labId, date }: { data: ConsoleDto; labId: string; date: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["console-roster", labId, date] });

  const entries = useMemo(
    () =>
      data.slots.flatMap((slot) =>
        slot.quickVisits.map((visit) => ({ visit, slotStartsAt: slot.startsAt })),
      ),
    [data.slots],
  );
  const open = entries.filter(
    ({ visit }) => visit.status !== "COMPLETED" && visit.status !== "CANCELLED",
  );
  const done = entries.filter(({ visit }) => visit.status === "COMPLETED");

  const act = async (visit: ConsoleQuickVisit, kind: "approve" | "in" | "out") => {
    setBusy(visit.id);
    try {
      if (kind === "approve") {
        await quickVisitsApi.decide(visit.id, "APPROVED");
        toast.success("Quick visit approved");
      } else if (kind === "in") {
        await visitsApi.checkIn({
          source: "QUICK_VISIT",
          quickVisitId: visit.id,
          idempotencyKey: crypto.randomUUID(),
        });
        toast.success("Visit permitted");
      } else if (visit.visitId) {
        await visitsApi.checkOut(visit.visitId, { idempotencyKey: crypto.randomUUID() });
        toast.success("Visit closed");
      }
      await refresh();
    } catch (error) {
      toast.error(readableError(error, "That could not be recorded"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
          Waiting at the desk
        </p>
        {open.length ? (
          <div className="card-surface divide-y divide-border overflow-hidden">
            {open.map(({ visit, slotStartsAt }) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <Footprints className="size-4.5" />
                    {visit.status === "ACTIVE" && (
                      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{visit.purpose}</p>
                    <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {visit.name}
                      {visit.prn && ` · PRN ${visit.prn}`} · from{" "}
                      {clock(slotStartsAt, data.lab.timeZone)} ·{" "}
                      {visit.status === "ACTIVE" ? "in the lab" : "awaiting entry"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {busy === visit.id && (
                    <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                  )}
                  {visit.canDecide && (
                    <button
                      type="button"
                      disabled={busy === visit.id}
                      onClick={() => void act(visit, "approve")}
                      className="pressable min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {visit.canCheckIn && (
                    <button
                      type="button"
                      disabled={busy === visit.id}
                      onClick={() => void act(visit, "in")}
                      className="pressable min-h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Permit
                    </button>
                  )}
                  {visit.canCheckOut && (
                    <button
                      type="button"
                      disabled={busy === visit.id}
                      onClick={() => void act(visit, "out")}
                      className="pressable min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      Mark exit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-surface px-6 py-10 text-center text-sm text-muted-foreground">
            Quick-visit requests will appear here the moment students send them.
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
            Completed today
          </p>
          <div className="card-surface divide-y divide-border overflow-hidden">
            {done.slice(0, 10).map(({ visit }) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{visit.purpose}</p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {visit.name} · in {visit.checkedInAt ? shortClock(visit.checkedInAt) : "—"} ·
                    out {visit.checkedOutAt ? shortClock(visit.checkedOutAt) : "—"}
                  </p>
                </div>
                <StatusBadge label="Quick Visit" className="shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Materials: verify what teams are collecting ──────────────── */

/**
 * Claims waiting at the desk.
 *
 * Issuing spends the material permanently, so each row names the project and
 * the person asking — the assistant hands it over to someone, and the record
 * should say who.
 */
function MaterialsDesk() {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const claims = useQuery({
    queryKey: ["console-claims", "pending"],
    queryFn: () => consumableClaimsApi.list({ status: "PENDING", limit: "50" }).then((r) => r.data),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
  const recent = useQuery({
    queryKey: ["console-claims", "issued"],
    queryFn: () => consumableClaimsApi.list({ status: "ISSUED", limit: "15" }).then((r) => r.data),
    staleTime: 30_000,
  });

  const decide = async (id: string, decision: "ISSUED" | "REJECTED", why?: string) => {
    setBusy(id);
    try {
      await consumableClaimsApi.decide(id, decision, why ?? null);
      await queryClient.invalidateQueries({ queryKey: ["console-claims"] });
      setDeclining(null);
      setReason("");
      toast.success(decision === "ISSUED" ? "Material issued" : "Claim declined");
    } catch (error) {
      toast.error(readableError(error, "That claim could not be answered"));
    } finally {
      setBusy(null);
    }
  };

  if (claims.isPending) {
    return <div className="card-surface h-40 animate-pulse bg-muted/40" aria-busy="true" />;
  }
  const pending = claims.data ?? [];

  return (
    <div className="mt-8 space-y-8">
      <section>
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
          Waiting to collect
        </p>
        {pending.length ? (
          <div className="card-surface divide-y divide-border overflow-hidden">
            {pending.map((claim) => (
              <div key={claim.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {claim.quantity} {claim.unit} · {claim.name}
                      {claim.variant && (
                        <span className="text-muted-foreground"> · {claim.variant}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {claim.projectTitle} · {claim.claimedByName}
                    </p>
                    {claim.note && (
                      <p className="mt-1 text-xs text-muted-foreground">{claim.note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {busy === claim.id && (
                      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                    )}
                    <button
                      type="button"
                      disabled={busy === claim.id}
                      onClick={() => setDeclining(declining === claim.id ? null : claim.id)}
                      className="pressable min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={busy === claim.id}
                      onClick={() => void decide(claim.id, "ISSUED")}
                      className="pressable min-h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Issue
                    </button>
                  </div>
                </div>
                {declining === claim.id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why is this declined?"
                      maxLength={300}
                      className="form-input min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      disabled={!reason.trim() || busy === claim.id}
                      onClick={() => void decide(claim.id, "REJECTED", reason.trim())}
                      className="pressable min-h-10 rounded-xl bg-destructive px-4 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
                    >
                      Confirm decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card-surface px-6 py-10 text-center text-sm text-muted-foreground">
            Material claims appear here the moment a team sends one.
          </div>
        )}
      </section>

      {(recent.data ?? []).length > 0 && (
        <section>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
            Recently issued
          </p>
          <div className="card-surface divide-y divide-border overflow-hidden">
            {(recent.data ?? []).map((claim) => (
              <div key={claim.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {claim.quantity} {claim.unit} · {claim.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {claim.projectTitle} · {claim.claimedByName}
                  </p>
                </div>
                <StatusBadge label="Collected" className="shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────── */

function countLiveBookings(data: ConsoleDto) {
  return data.slots.reduce(
    (sum, slot) =>
      sum +
      slot.bookings.filter(
        (booking) => booking.status === "CONFIRMED" || booking.status === "ACTIVE",
      ).length,
    0,
  );
}

function countOpenQuickVisits(data: ConsoleDto) {
  return data.slots.reduce(
    (sum, slot) =>
      sum +
      slot.quickVisits.filter(
        (visit) => visit.status !== "COMPLETED" && visit.status !== "CANCELLED",
      ).length,
    0,
  );
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function clock(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function shortClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "2026-09-03" → the same calendar day, shifted by whole days. */
/** The lab-local calendar day an instant falls on. */
function localDayOf(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return shifted.toISOString().slice(0, 10);
}

function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function longDateFromLocal(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function longDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}
