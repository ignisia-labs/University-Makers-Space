import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { SlotBookingModal } from "@/components/Booking/SlotBookingModal";
import { ConsumableClaims } from "@/components/Booking/ConsumableClaims";
import { StatusBadge } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ApiError,
  bookingsApi,
  labsApi,
  readableError,
  type BookingDto,
  type DailyAvailability,
  type ProjectDetail,
  type ProjectSummary,
  type SlotEquipment,
} from "@/lib/api";
import { invalidateBookingData, usePersistedBookings } from "@/lib/booking-queries";
import { usePersistedProject, usePersistedProjectPages } from "@/lib/project-queries";
import { useAppSession } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type Tab = "current" | "past";
type AvailabilitySlot = DailyAvailability["slots"][number];

/**
 * The student's slots page.
 *
 * One live session at a time, mirroring the server rule: while a booking is
 * upcoming this shows that booking and nothing else, because offering a booking
 * form the server would refuse is worse than not offering it.
 */
export function PersistedAvailability({
  preselectedProjectId,
}: {
  preselectedProjectId?: string | undefined;
}) {
  const [tab, setTab] = useState<Tab>("current");
  const queryClient = useQueryClient();

  const upcoming = usePersistedBookings("upcoming", 1, 20, true);
  const past = usePersistedBookings("past", 1, 20, tab === "past");
  const liveBooking =
    upcoming.data?.data.find(
      (booking) => booking.status === "CONFIRMED" || booking.status === "ACTIVE",
    ) ?? null;

  const [cancelTarget, setCancelTarget] = useState<BookingDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const cancelBooking = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      bookingsApi.cancel(input.id, {
        reason: input.reason,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await invalidateBookingData(queryClient);
      setCancelTarget(null);
      setCancelReason("");
      toast.success("Session cancelled — the slot and its machines are free again");
    },
    onError: (error) => toast.error(readableError(error, "Could not cancel this session")),
  });

  const completeBooking = useMutation({
    mutationFn: (id: string) => bookingsApi.complete(id),
    onSuccess: async () => {
      await invalidateBookingData(queryClient);
      setTab("past");
      toast.success("Session ended — logged to your visits");
    },
    onError: (error) => toast.error(readableError(error, "Could not end this session")),
  });

  return (
    <AppShell
      title="Slots"
      subtitle={liveBooking ? "Your next session" : "Reserve MakerSpace time"}
    >
      <div className="mx-auto max-w-3xl">
        <div
          role="tablist"
          aria-label="Slot views"
          className="inline-flex rounded-full border border-border bg-card p-1"
        >
          {(
            [
              { id: "current", label: liveBooking ? "Upcoming" : "Book" },
              { id: "past", label: "Past sessions" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "min-h-10 rounded-full px-5 text-xs font-semibold uppercase tracking-wider transition-colors",
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "past" ? (
            <PastSessions bookings={past.data?.data ?? []} loading={past.isPending} />
          ) : upcoming.isPending ? (
            <LoadingCard label="Loading your sessions…" />
          ) : liveBooking ? (
            <UpcomingSession
              booking={liveBooking}
              busy={completeBooking.isPending}
              onCancel={() => {
                setCancelTarget(liveBooking);
                setCancelReason("");
              }}
              onComplete={() => completeBooking.mutate(liveBooking.id)}
            />
          ) : (
            <BookingFlow preselectedProjectId={preselectedProjectId} />
          )}
        </div>
      </div>

      <ResponsiveModal
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this session?"
        description="The reserved seats and machines are released and the booking moves to your past sessions."
      >
        <label className="block text-sm font-medium">
          Reason for cancellation
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Briefly tell the team why"
            className="form-input mt-2 min-h-24 resize-none py-3"
          />
        </label>
        <button
          type="button"
          disabled={!cancelReason.trim() || cancelBooking.isPending}
          onClick={() =>
            cancelTarget &&
            cancelBooking.mutate({ id: cancelTarget.id, reason: cancelReason.trim() })
          }
          className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-all duration-200 disabled:opacity-50"
        >
          {cancelBooking.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Confirm cancellation
        </button>
      </ResponsiveModal>
    </AppShell>
  );
}

/* ── Upcoming session (full page — one booking at a time) ─────── */

function UpcomingSession({
  booking,
  busy,
  onCancel,
  onComplete,
}: {
  booking: BookingDto;
  busy: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-border bg-secondary/50 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Upcoming session
          </p>
          <StatusBadge label={booking.statusLabel} />
        </div>
        <h2 className="mt-3 font-serif text-2xl font-light tracking-wide sm:text-3xl">
          {booking.projectTitle}
        </h2>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="space-y-4">
          <SessionFact icon={CalendarDays} label="Date" value={longDate(start, booking.timeZone)} />
          <SessionFact
            icon={Clock3}
            label="Time"
            value={`${clock(start, booking.timeZone)} – ${clock(end, booking.timeZone)}`}
          />
          <SessionFact
            icon={Users}
            label="Attending"
            value={`${booking.attendeeCount} ${booking.attendeeCount === 1 ? "person" : "people"}`}
          />
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Team
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {booking.participants.map((participant) => (
              <span
                key={participant.userId}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
              >
                {participant.name}
              </span>
            ))}
          </div>
          {booking.equipment.length > 0 && (
            <>
              <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Reserved kit
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {booking.equipment.map((item) => (
                  <li
                    key={item.equipmentId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1 text-xs font-medium text-primary"
                  >
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                    {item.name}
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                      held
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Materials are claimed here, during the session — not at booking time,
          when nobody yet knows what the build will actually need. */}
      <ConsumableClaims projectId={booking.projectId} bookingId={booking.id} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-8">
        <p className="text-xs text-muted-foreground">
          {booking.canComplete
            ? "Session in progress — end it when your team is done and the machines are released."
            : "One session at a time — cancel to book a different slot."}
        </p>
        <div className="flex flex-wrap gap-2">
          {booking.canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="pressable min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-all duration-200 hover:bg-destructive/10"
            >
              Cancel session
            </button>
          )}
          {/* Ending only unlocks once the MakerSpace has checked the team in. */}
          {booking.canComplete && (
            <button
              type="button"
              disabled={busy}
              onClick={onComplete}
              className="pressable inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              End session
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SessionFact({
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
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

/* ── Booking flow ─────────────────────────────────────────────── */

function BookingFlow({ preselectedProjectId }: { preselectedProjectId?: string | undefined }) {
  const queryClient = useQueryClient();
  const { user: viewer } = useAppSession();

  // Verified projects only, narrowed server-side; leadership is decided from
  // the viewer relationship the server attaches to each row.
  const projectPages = usePersistedProjectPages({ status: "VERIFIED" });
  // Only a verified project you lead can be booked; that is the server's rule,
  // so the picker offers nothing else rather than failing at confirmation.
  const bookableProjects = useMemo(
    () =>
      (projectPages.data?.pages.flatMap((page) => page.data) ?? []).filter(
        (project: ProjectSummary) =>
          project.viewerRelationship === "LEADER" && project.status === "VERIFIED",
      ),
    [projectPages.data],
  );

  const [projectId, setProjectId] = useState("");
  useEffect(() => {
    if (projectId && bookableProjects.some((project) => project.id === projectId)) return;
    const preferred =
      bookableProjects.find((project) => project.id === preselectedProjectId) ??
      bookableProjects[0];
    setProjectId(preferred?.id ?? "");
  }, [bookableProjects, preselectedProjectId, projectId]);

  const projectDetail = usePersistedProject(projectId, Boolean(projectId));
  const project = projectDetail.data ?? null;
  const labId = project?.labId ?? bookableProjects[0]?.labId ?? "";

  // Only teammates who accepted can attend; the rest are invisible here, which
  // is what makes a project bookable before everyone has replied.
  const attendees = useMemo(() => acceptedAttendees(project, viewer?.id), [project, viewer?.id]);
  const [attending, setAttending] = useState<string[]>([]);
  useEffect(() => {
    const leaderId = project?.creatorId;
    setAttending(leaderId ? [leaderId] : []);
  }, [project?.creatorId, projectId]);

  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const participantCount = Math.max(1, attending.length);

  const dates = useQuery({
    queryKey: ["availability-dates", labId, projectId, participantCount],
    queryFn: () =>
      labsApi.availabilityDates(labId, projectId, participantCount).then((r) => r.data),
    enabled: Boolean(labId && projectId),
    staleTime: 30_000,
  });
  const openDates = useMemo(
    () => (dates.data?.dates ?? []).filter((entry) => entry.isOpen && entry.slotCount > 0),
    [dates.data],
  );
  useEffect(() => {
    if (openDates.length === 0) return;
    if (openDates.some((entry) => entry.date === date)) return;
    setDate(openDates[0]!.date);
    setSlotId(null);
  }, [openDates, date]);

  const day = useQuery({
    queryKey: ["availability-day", labId, date, projectId, participantCount],
    queryFn: () =>
      labsApi.dailyAvailability(labId, date, projectId, participantCount).then((r) => r.data),
    enabled: Boolean(labId && projectId && date),
    staleTime: 15_000,
  });
  const slots = day.data?.slots ?? [];
  const selectedSlot = slots.find((slot) => slot.id === slotId) ?? null;

  const createBooking = useMutation({
    mutationFn: (equipmentIds: string[]) =>
      bookingsApi.create({
        labSlotId: selectedSlot!.id,
        projectId,
        participantIds: attending,
        equipmentIds,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await invalidateBookingData(queryClient);
      setConfirmOpen(false);
      setSlotId(null);
      toast.success("Reservation confirmed");
    },
    onError: (error) => {
      // The server's reason is the useful part — a slot that filled up, or a
      // machine another team took while this form was open.
      toast.error(readableError(error, "Could not reserve this slot"));
      if (error instanceof ApiError) void day.refetch();
    },
  });

  if (projectPages.isPending) return <LoadingCard label="Loading your projects…" />;

  // A failed load must say so. Falling through to the "no verified projects"
  // empty state would blame the student for a server problem.
  if (projectPages.isError) {
    return (
      <section className="card-surface px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">
          {readableError(projectPages.error, "Your projects could not be loaded.")}
        </p>
        <button
          type="button"
          onClick={() => void projectPages.refetch()}
          className="pressable mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
        >
          Try again
        </button>
      </section>
    );
  }

  if (bookableProjects.length === 0) {
    return (
      <section className="card-surface px-6 py-14 text-center sm:py-20">
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Chapter 02</p>
        <h2 className="mt-3 font-serif text-2xl font-light tracking-wide sm:text-3xl">
          Almost there
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Slots unlock once one of your projects is verified by its mentor.
        </p>
        <Link
          to="/projects"
          className="pressable mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Go to projects
        </Link>
      </section>
    );
  }

  const toggleAttendee = (id: string) =>
    setAttending((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  return (
    <div className="space-y-6">
      <Step title="Project" aside={`${bookableProjects.length} verified`}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {bookableProjects.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={entry.id === projectId}
                onClick={() => {
                  setProjectId(entry.id);
                  setSlotId(null);
                }}
                className={cn(
                  "min-h-16 w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  entry.id === projectId
                    ? "border-primary bg-primary/[0.05]"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="block text-sm font-semibold">{entry.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {entry.memberCount} {entry.memberCount === 1 ? "member" : "members"}
                  {entry.pendingMemberCount > 0 && ` · ${entry.pendingMemberCount} not replied`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Step>

      <Step title="Who's coming" aside={`${attending.length} of ${attendees.length}`}>
        {projectDetail.isPending ? (
          <p className="py-3 text-sm text-muted-foreground">Loading your team…</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {attendees.map((attendee) => (
                <AttendeeRow
                  key={attendee.id}
                  id={attendee.id}
                  name={attendee.name}
                  meta={attendee.meta}
                  checked={attending.includes(attendee.id)}
                  onToggle={toggleAttendee}
                />
              ))}
            </ul>
            {attendees.length === 1 && (
              <p className="pt-3 text-xs text-muted-foreground">
                Going solo is fine. Teammates appear here once they accept their invitation.
              </p>
            )}
          </>
        )}
      </Step>

      <Step title="Date">
        {dates.isPending ? (
          <p className="py-3 text-sm text-muted-foreground">Loading open days…</p>
        ) : openDates.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            The MakerSpace has no open days in the booking window right now.
          </p>
        ) : (
          <ul className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
            {openDates.map((entry) => {
              const parsed = parseLocalDate(entry.date);
              return (
                <li key={entry.date} className="snap-start">
                  <button
                    type="button"
                    aria-pressed={entry.date === date}
                    onClick={() => {
                      setDate(entry.date);
                      setSlotId(null);
                    }}
                    className={cn(
                      "flex min-h-20 w-[4.5rem] flex-col items-center justify-center rounded-2xl border transition-colors",
                      entry.date === date
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                      {parsed.day}
                    </span>
                    <span className="font-serif text-2xl font-light">{parsed.date}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                      {parsed.month}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Step>

      <Step
        title="Time"
        aside={(project?.equipment.length ?? 0) > 0 ? "Your machines per slot" : undefined}
      >
        {day.isPending ? (
          <p className="py-3 text-sm text-muted-foreground">Loading slots…</p>
        ) : slots.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No slots remain on this day. Try another date.
          </p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {slots.map((slot) => (
              <li key={slot.id}>
                <SlotCard
                  slot={slot}
                  selected={slot.id === slotId}
                  needed={attending.length}
                  onSelect={() => setSlotId(slot.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Step>

      <button
        type="button"
        disabled={!selectedSlot || attending.length === 0}
        onClick={() => setConfirmOpen(true)}
        className="pressable inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Review reservation
      </button>

      <SlotBookingModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        projectName={project?.title ?? "—"}
        date={date ? longDateFromLocal(date) : "No date selected"}
        slot={selectedSlot ? `${selectedSlot.startTime} – ${selectedSlot.endTime}` : "—"}
        attendees={attending.length}
        equipment={selectedSlot?.equipment ?? []}
        submitting={createBooking.isPending}
        onConfirm={(equipmentIds) => createBooking.mutate(equipmentIds)}
      />
    </div>
  );
}

/** One bookable slot: seats left, and which of the project's machines are free. */
function SlotCard({
  slot,
  selected,
  needed,
  onSelect,
}: {
  slot: AvailabilitySlot;
  selected: boolean;
  needed: number;
  onSelect: () => void;
}) {
  const left = slot.remainingCapacity;
  const full = left < Math.max(1, needed);
  const machines = slot.equipment;
  const freeCount = slot.equipmentAvailable;

  return (
    <button
      type="button"
      disabled={full}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/[0.05]"
          : "border-border bg-card hover:border-primary/40",
        full && "cursor-not-allowed opacity-45 hover:border-border",
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-serif text-base font-medium tracking-wide">
          {slot.startTime} – {slot.endTime}
        </span>
        <span className="flex items-center gap-2">
          {machines.length > 0 && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-wider",
                freeCount === machines.length
                  ? "border-primary/25 bg-primary/[0.06] text-primary"
                  : freeCount === 0
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-warning/40 bg-warning/10 text-warning-foreground",
              )}
            >
              {freeCount}/{machines.length} machines
            </span>
          )}
          <span
            className={cn(
              "text-[10px] font-mono uppercase tracking-wider",
              left === 0
                ? "text-destructive"
                : left <= 3
                  ? "text-warning-foreground"
                  : "text-muted-foreground",
            )}
          >
            {left === 0 ? "Full" : `${left} seats`}
          </span>
        </span>
      </span>

      {machines.length > 0 && (
        <span className="mt-3 block divide-y divide-border/60 border-t border-border/60">
          {machines.map((machine) => (
            <span
              key={machine.equipmentId}
              className="flex min-h-8 items-center justify-between gap-3 py-1"
            >
              <span
                className={cn(
                  "flex items-center gap-2 text-xs",
                  machine.available ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    machine.available
                      ? "bg-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                      : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                {machine.name}
              </span>
              <span
                className={cn(
                  "text-[9px] font-mono uppercase tracking-widest",
                  machine.available ? "text-primary" : "text-muted-foreground/70",
                )}
              >
                {machine.available ? "Free" : "Taken"}
              </span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function AttendeeRow({
  id,
  name,
  meta,
  checked,
  onToggle,
}: {
  id: string;
  name: string;
  meta: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <li>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
        <Checkbox checked={checked} onCheckedChange={() => onToggle(id)} className="size-6" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        </span>
      </label>
    </li>
  );
}

function Step({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-primary">{title}</h2>
        {aside && (
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/* ── Past sessions ────────────────────────────────────────────── */

function PastSessions({ bookings, loading }: { bookings: BookingDto[]; loading: boolean }) {
  if (loading) return <LoadingCard label="Loading past sessions…" />;
  if (!bookings.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        Completed and cancelled sessions will appear here.
      </div>
    );
  }
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border pl-6">
      {bookings.map((booking) => (
        <li key={booking.id} className="relative">
          <span
            className={cn(
              "absolute -left-[1.83rem] top-6 size-3 rounded-full border-2 border-background",
              booking.status === "COMPLETED" ? "bg-primary" : "bg-muted-foreground/50",
            )}
            aria-hidden
          />
          <article className="card-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-serif text-base font-light tracking-wide sm:text-lg">
                  {booking.projectTitle}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {longDate(new Date(booking.startsAt), booking.timeZone)} ·{" "}
                  {clock(new Date(booking.startsAt), booking.timeZone)} –{" "}
                  {clock(new Date(booking.endsAt), booking.timeZone)} · {booking.attendeeCount}{" "}
                  {booking.attendeeCount === 1 ? "attendee" : "attendees"}
                </p>
              </div>
              <StatusBadge label={booking.statusLabel} />
            </div>
            {booking.cancellationReason && (
              <p className="mt-3 rounded-xl bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
                {booking.cancellationReason}
              </p>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="card-surface flex items-center justify-center gap-3 px-6 py-14 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────── */

/**
 * The leader plus every teammate who has accepted.
 *
 * A pending or declined invitation is deliberately absent: the project can be
 * verified and booked before everyone replies, and offering an unconfirmed name
 * as an attendee would let a team reserve a seat for somebody who never joined.
 */
function acceptedAttendees(project: ProjectDetail | null, viewerId: string | undefined) {
  if (!project) return [];
  const rows = project.members
    .filter((member) => member.status === "ACCEPTED" && member.userId)
    .map((member) => ({
      id: member.userId!,
      name: member.userId === viewerId ? `${member.name} (You)` : member.name,
      meta: member.role === "LEADER" ? "Project lead" : (member.department?.name ?? member.email),
      isLeader: member.role === "LEADER",
    }));
  // The leader always heads the list.
  return rows.sort((a, b) => Number(b.isLeader) - Number(a.isLeader));
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

function longDateFromLocal(value: string) {
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, dayOfMonth!)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function longDate(instant: Date, timeZone: string) {
  return instant.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}

function clock(instant: Date, timeZone: string) {
  return instant.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export type { SlotEquipment };
