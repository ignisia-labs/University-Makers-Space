import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SlotBookingModal } from "@/components/Booking/SlotBookingModal";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Project, Reservation } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { project?: string } =>
    typeof search["project"] === "string" ? { project: search["project"] } : {},
  head: () => ({
    meta: [
      { title: "Slots — MIT-WPU MakerSpace" },
      {
        name: "description",
        content: "Reserve a MakerSpace slot for your verified project and team.",
      },
    ],
  }),
  component: BookPage,
});

type Tab = "current" | "past";

function BookPage() {
  const {
    projects,
    profile,
    reservations,
    equipment,
    slots,
    addReservation,
    cancelReservation,
    completeReservation,
  } = useMakerSpace();
  const { project: preselectedProjectId } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("current");

  const isLeaderOf = (project: Project) =>
    Boolean(profile.fullName) && project.leader.toLowerCase() === profile.fullName.toLowerCase();
  const myProjects = projects.filter(
    (project) =>
      isLeaderOf(project) ||
      project.members.some((member) => member.email?.toLowerCase() === profile.email.toLowerCase()),
  );
  const myProjectIds = new Set(myProjects.map((project) => project.id));
  const leaderProjectIds = new Set(myProjects.filter(isLeaderOf).map((project) => project.id));
  const myReservations = reservations.filter((reservation) =>
    myProjectIds.has(reservation.projectId),
  );
  const upcoming = [...myReservations]
    .filter((reservation) => reservation.status === "Active")
    .sort((a, b) => bookingDay(a.date) - bookingDay(b.date));
  const past = [...myReservations]
    .filter((reservation) => reservation.status !== "Active")
    .sort((a, b) => bookingDay(b.date) - bookingDay(a.date));

  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  return (
    <AppShell
      title="Slots"
      subtitle={upcoming.length ? "Your next session" : "Reserve MakerSpace time"}
    >
      <div className="mx-auto max-w-3xl">
        <div
          role="tablist"
          aria-label="Slot views"
          className="inline-flex rounded-full border border-border bg-card p-1"
        >
          {(
            [
              { id: "current", label: upcoming.length ? "Upcoming" : "Book" },
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
            <PastSessions reservations={past} />
          ) : upcoming.length ? (
            <UpcomingSession
              booking={upcoming[0]!}
              project={myProjects.find((project) => project.id === upcoming[0]!.projectId)}
              equipment={equipment}
              canManage={leaderProjectIds.has(upcoming[0]!.projectId)}
              onCancel={() => {
                setCancelTarget(upcoming[0]!);
                setCancelReason("");
              }}
              onComplete={() => {
                completeReservation(upcoming[0]!.id);
                toast.success("Session completed — logged to your visits");
                setTab("past");
              }}
            />
          ) : (
            <BookingFlow
              projects={myProjects.filter(
                (project) => leaderProjectIds.has(project.id) && project.status === "Verified",
              )}
              profileName={profile.fullName}
              preselectedProjectId={preselectedProjectId}
              reservations={reservations}
              equipment={equipment}
              slots={slots}
              onReserve={(reservation) => {
                addReservation(reservation);
                toast.success("Reservation confirmed");
              }}
            />
          )}
        </div>
      </div>

      <ResponsiveModal
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this session?"
        description="The reserved capacity is released and the booking moves to your past sessions."
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
          disabled={!cancelReason.trim()}
          onClick={() => {
            if (!cancelTarget) return;
            cancelReservation(cancelTarget.id, cancelReason.trim());
            setCancelTarget(null);
            setCancelReason("");
            toast.success("Reservation cancelled");
          }}
          className="pressable mt-5 min-h-12 w-full rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-all duration-200 disabled:opacity-50"
        >
          Confirm cancellation
        </button>
      </ResponsiveModal>
    </AppShell>
  );
}

/* ── Upcoming session (full page — one booking at a time) ─────── */

function UpcomingSession({
  booking,
  project,
  equipment,
  canManage,
  onCancel,
  onComplete,
}: {
  booking: Reservation;
  project: Project | undefined;
  equipment: ReturnType<typeof useMakerSpace>["equipment"];
  canManage: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const hasEntered = Object.values(booking.attendance ?? {}).some((record) => record.enteredAt);
  const attendees = booking.participantIds.map((id) => {
    if (id === "leader") return project?.leader ?? "Team leader";
    return project?.members.find((member) => member.id === id)?.name ?? "Team member";
  });

  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-border bg-secondary/50 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Upcoming session
          </p>
          <StatusBadge label="Confirmed" />
        </div>
        <h2 className="mt-3 font-serif text-2xl font-light tracking-wide sm:text-3xl">
          {booking.projectName}
        </h2>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="space-y-4">
          <SessionFact icon={CalendarDays} label="Date" value={booking.date} />
          <SessionFact icon={Clock3} label="Time" value={booking.slot} />
          <SessionFact
            icon={Users}
            label="Attending"
            value={`${booking.attendees} ${booking.attendees === 1 ? "person" : "people"}`}
          />
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Team
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...new Set(attendees)].map((name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
              >
                {name}
              </span>
            ))}
          </div>
          {booking.resources.length > 0 && (
            <>
              <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Reserved kit
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {booking.resources.map((resource) => (
                  <EquipmentChip
                    key={resource}
                    name={resource}
                    available={isProjectEquipmentAvailable(resource, equipment)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-8">
        <p className="text-xs text-muted-foreground">
          {hasEntered
            ? "Session in progress — mark it completed when your team is done."
            : "One session at a time — cancel to book a different slot."}
        </p>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="pressable min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-all duration-200 hover:bg-destructive/10"
            >
              Cancel session
            </button>
            {/* Completion only unlocks once the lab assistant has permitted entry. */}
            {hasEntered && (
              <button
                type="button"
                onClick={onComplete}
                className="pressable min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90"
              >
                Mark completed
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EquipmentChip({ name, available }: { name: string; available: boolean }) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        available
          ? "border-primary/20 bg-primary/[0.05] text-primary"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", available ? "bg-primary" : "bg-muted-foreground/50")}
        aria-hidden
      />
      {name}
      <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
        {available ? "free" : "in use"}
      </span>
    </li>
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

function BookingFlow({
  projects,
  profileName,
  preselectedProjectId,
  reservations,
  equipment,
  slots,
  onReserve,
}: {
  projects: Project[];
  profileName: string;
  preselectedProjectId?: string | undefined;
  reservations: Reservation[];
  equipment: ReturnType<typeof useMakerSpace>["equipment"];
  slots: ReturnType<typeof useMakerSpace>["slots"];
  onReserve: (reservation: Omit<Reservation, "id">) => void;
}) {
  const publishedSlots = slots.filter((slot) => slot.published);
  const bookingDates = useMemo(
    () => [
      ...new Map(
        publishedSlots.map((slot) => [
          slot.dateId,
          { id: slot.dateId, day: slot.day, date: slot.date, month: slot.month },
        ]),
      ).values(),
    ],
    [publishedSlots],
  );
  // Default to whatever the student selected on the dashboard.
  const [projectId, setProjectId] = useState(
    projects.some((p) => p.id === preselectedProjectId)
      ? preselectedProjectId!
      : (projects[0]?.id ?? ""),
  );
  const project = projects.find((p) => p.id === projectId);
  const projectResources = project?.resources ?? [];
  const [attending, setAttending] = useState<string[]>(["leader"]);
  const [dateId, setDateId] = useState(bookingDates[0]?.id ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedDate = bookingDates.find((d) => d.id === dateId);
  const dateSlots = publishedSlots.filter((slot) => slot.dateId === dateId);
  const selectedSlot = dateSlots.find((slot) => slot.id === slotId);
  const capacityUsed = attending.length;
  const unavailableResources = useMemo(
    () =>
      (project?.resources ?? []).filter(
        (resource) => !isProjectEquipmentAvailable(resource, equipment),
      ),
    [project, equipment],
  );

  useEffect(() => {
    if (!dateId && bookingDates[0]) setDateId(bookingDates[0].id);
  }, [bookingDates, dateId]);

  const toggleAttendee = (id: string) =>
    setAttending((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  if (!projects.length) {
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

  return (
    <div className="space-y-6">
      <Step title="Project" aside={`${projects.length} verified`}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={p.id === projectId}
                onClick={() => {
                  setProjectId(p.id);
                  setAttending(["leader"]);
                  setSlotId(null);
                }}
                className={cn(
                  "min-h-16 w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  p.id === projectId
                    ? "border-primary bg-primary/[0.05]"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {p.members.length + 1} {p.members.length === 0 ? "member" : "members"} ·{" "}
                  {p.resources.length} {p.resources.length === 1 ? "machine" : "machines"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Step>

      <Step title="Who's coming" aside={`${capacityUsed} of ${(project?.members.length ?? 0) + 1}`}>
        <ul className="divide-y divide-border">
          <AttendeeRow
            id="leader"
            name={`${profileName} (You)`}
            meta="Project lead"
            checked={attending.includes("leader")}
            onToggle={toggleAttendee}
          />
          {project?.members.map((m) => (
            <AttendeeRow
              key={m.id}
              id={m.id}
              name={m.name}
              meta={m.department}
              checked={attending.includes(m.id)}
              onToggle={toggleAttendee}
            />
          ))}
        </ul>
      </Step>

      <Step title="Date">
        <ul className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
          {bookingDates.map((d) => (
            <li key={d.id} className="snap-start">
              <button
                type="button"
                aria-pressed={d.id === dateId}
                onClick={() => {
                  setDateId(d.id);
                  setSlotId(null);
                }}
                className={cn(
                  "flex min-h-20 w-[4.5rem] flex-col items-center justify-center rounded-2xl border transition-colors",
                  d.id === dateId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                  {d.day}
                </span>
                <span className="font-serif text-2xl font-light">{d.date}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                  {d.month}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Step>

      <Step title="Time" aside={projectResources.length ? "Your machines per slot" : undefined}>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {dateSlots.map((slot) => {
            const slotReservations = reservations.filter(
              (reservation) =>
                reservation.status === "Active" &&
                (reservation.slotId === slot.id ||
                  (!reservation.slotId &&
                    reservation.date === `${slot.day}, ${slot.date} ${slot.month}` &&
                    reservation.slot === slot.label)),
            );
            const booked = slotReservations.reduce(
              (total, reservation) => total + reservation.attendees,
              0,
            );
            const left = Math.max(0, slot.capacity - booked);
            const full = left < capacityUsed;
            const active = slot.id === slotId;
            // A machine is taken for this slot if the catalogue says so, or another
            // team has already reserved it at the same time.
            const claimed = new Set(
              slotReservations.flatMap((reservation) => reservation.resources),
            );
            const machines = projectResources.map((resource) => ({
              name: resource,
              available: isProjectEquipmentAvailable(resource, equipment) && !claimed.has(resource),
            }));
            const freeCount = machines.filter((machine) => machine.available).length;
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  disabled={full}
                  aria-pressed={active}
                  onClick={() => setSlotId(slot.id)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/[0.05]"
                      : "border-border bg-card hover:border-primary/40",
                    full && "cursor-not-allowed opacity-45 hover:border-border",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-medium tracking-wide">
                      {slot.label}
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
                          key={machine.name}
                          className="flex min-h-8 items-center justify-between gap-3 py-1"
                        >
                          <span
                            className={cn(
                              "flex items-center gap-2 text-xs",
                              machine.available
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
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
              </li>
            );
          })}
        </ul>
      </Step>

      <button
        type="button"
        disabled={!selectedSlot || capacityUsed === 0}
        onClick={() => setConfirmOpen(true)}
        className="pressable inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Review reservation
      </button>

      <SlotBookingModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        projectName={project?.name ?? "—"}
        date={
          selectedDate
            ? `${selectedDate.day}, ${selectedDate.date} ${selectedDate.month}`
            : "No date selected"
        }
        slot={selectedSlot?.label ?? "—"}
        attendees={capacityUsed}
        projectResources={project?.resources ?? []}
        unavailableResources={unavailableResources}
        onConfirm={(resources) => {
          onReserve({
            projectId: project?.id ?? "",
            projectName: project?.name ?? "",
            date: selectedDate
              ? `${selectedDate.day}, ${selectedDate.date} ${selectedDate.month}`
              : "",
            slot: selectedSlot?.label ?? "",
            ...(selectedSlot?.id ? { slotId: selectedSlot.id } : {}),
            attendees: capacityUsed,
            participantIds: attending,
            status: "Active",
            resources,
          });
          setConfirmOpen(false);
        }}
      />
    </div>
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

function PastSessions({ reservations }: { reservations: Reservation[] }) {
  if (!reservations.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        Completed and cancelled sessions will appear here.
      </div>
    );
  }
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border pl-6">
      {reservations.map((reservation) => {
        const displayStatus = reservation.status === "No Show" ? "No-Show" : reservation.status;
        return (
          <li key={reservation.id} className="relative">
            <span
              className={cn(
                "absolute -left-[1.83rem] top-6 size-3 rounded-full border-2 border-background",
                reservation.status === "Completed" ? "bg-primary" : "bg-muted-foreground/50",
              )}
              aria-hidden
            />
            <article className="card-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif text-base font-light tracking-wide sm:text-lg">
                    {reservation.projectName}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reservation.date} · {reservation.slot} · {reservation.attendees}{" "}
                    {reservation.attendees === 1 ? "attendee" : "attendees"}
                  </p>
                </div>
                <StatusBadge label={displayStatus} />
              </div>
              {(reservation.cancelledReason || reservation.noShowReason) && (
                <p className="mt-3 rounded-xl bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {reservation.cancelledReason ?? reservation.noShowReason}
                </p>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function bookingDay(date: string) {
  return Number(date.match(/\b(\d{1,2})\b/)?.[1] ?? 0);
}

function isProjectEquipmentAvailable(
  resource: string,
  equipment: ReturnType<typeof useMakerSpace>["equipment"],
) {
  const key = resource.toLowerCase();
  const match = equipment.find((item) => {
    const name = item.name.toLowerCase();
    return (
      name.includes(key) ||
      key.includes(name) ||
      (key.includes("printer") && item.category === "3D Printing") ||
      (key.includes("laser") && item.category === "Laser") ||
      (key.includes("robot") && item.category === "Robotics") ||
      (key.includes("workstation") && item.category === "Workstations") ||
      ((key.includes("solder") || key.includes("oscilloscope")) && item.category === "Electronics")
    );
  });
  return match
    ? match.visible &&
        match.bookingVisible !== false &&
        match.availableQuantity > 0 &&
        (match.status === "Available" || match.status === "Partially Available")
    : true;
}
