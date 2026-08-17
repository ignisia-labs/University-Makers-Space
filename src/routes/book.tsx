import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CircleAlert, Clock3, FolderKanban, History, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SlotBookingModal } from "@/components/Booking/SlotBookingModal";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Reservation } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a slot — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Reserve a capacity-aware MakerSpace slot for your verified project and attending team members.",
      },
      { property: "og:title", content: "Book a slot — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Capacity-aware slot booking for verified MakerSpace projects.",
      },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { projects, profile, reservations, equipment, slots, addReservation, cancelReservation } =
    useMakerSpace();
  const leaderProjects = projects.filter(
    (project) => project.leader.toLowerCase() === profile.fullName.toLowerCase(),
  );
  const leaderProjectIds = new Set(leaderProjects.map((project) => project.id));
  const studentReservations = reservations.filter((reservation) =>
    leaderProjectIds.has(reservation.projectId),
  );
  const verified = leaderProjects.filter((project) => project.status === "Verified");
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
  const [projectId, setProjectId] = useState(verified[0]?.id ?? "");
  const project = verified.find((p) => p.id === projectId);
  const [attending, setAttending] = useState<string[]>(["leader"]);
  const [dateId, setDateId] = useState(bookingDates[0]?.id ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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

  if (verified.length === 0) {
    return (
      <AppShell title="Book a slot">
        <div className="card-surface p-8 text-center">
          <CircleAlert className="mx-auto size-6 text-warning" />
          <p className="mt-3 text-sm text-muted-foreground">
            You need at least one verified project before booking a slot.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Book a slot" subtitle="Capacity-aware reservation">
      <div className="space-y-6">
        {studentReservations
          .filter((reservation) => reservation.status === "Active")
          .map((reservation) => (
            <section key={reservation.id} className="card-surface border-warning/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Upcoming booking</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reservation.projectName} · {reservation.date} · {reservation.slot}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCancelTarget(reservation);
                    setCancelReason("");
                  }}
                  className="pressable min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-all duration-200 hover:bg-destructive/10"
                >
                  Cancel booking
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Cancelling releases reserved capacity and keeps the booking in history.
              </p>
            </section>
          ))}
        <Step index={1} title="Select verified project">
          <ul className="grid gap-3 sm:grid-cols-2">
            {verified.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={p.id === projectId}
                  onClick={() => {
                    setProjectId(p.id);
                    setAttending(["leader"]);
                  }}
                  className={cn(
                    "min-h-16 w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    p.id === projectId
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-accent/60",
                  )}
                >
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.members.length + 1} {p.members.length === 0 ? "member" : "members"} ·{" "}
                    {p.mentor}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Step>

        <Step
          index={2}
          title="Attending team members"
          aside={`${capacityUsed} of ${(project?.members.length ?? 0) + 1} attending`}
        >
          <ul className="divide-y divide-border">
            <AttendeeRow
              id="leader"
              name={`${profile.fullName} (You)`}
              meta="Project leader"
              checked={attending.includes("leader")}
              onToggle={toggleAttendee}
            />
            {project?.members.map((m) => (
              <AttendeeRow
                key={m.id}
                id={m.id}
                name={m.name}
                meta={`${m.department} · PRN ${m.prn}`}
                checked={attending.includes(m.id)}
                onToggle={toggleAttendee}
              />
            ))}
          </ul>
          <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            This booking will consume <strong>{capacityUsed}</strong> of the lab's capacity for the
            selected slot.
          </p>
        </Step>

        <Step index={3} title="Pick a date">
          <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
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
                      : "border-border bg-card hover:bg-accent",
                  )}
                >
                  <span className="text-xs font-medium opacity-80">{d.day}</span>
                  <span className="text-xl font-bold">{d.date}</span>
                  <span className="text-xs opacity-80">{d.month}</span>
                </button>
              </li>
            ))}
          </ul>
        </Step>

        <Step index={4} title="Choose a time slot">
          <ul className="grid gap-3 sm:grid-cols-2">
            {dateSlots.map((slot) => {
              const booked = reservations
                .filter(
                  (reservation) =>
                    reservation.status === "Active" &&
                    (reservation.slotId === slot.id ||
                      (!reservation.slotId &&
                        reservation.date === `${slot.day}, ${slot.date} ${slot.month}` &&
                        reservation.slot === slot.label)),
                )
                .reduce((total, reservation) => total + reservation.attendees, 0);
              const left = Math.max(0, slot.capacity - booked);
              const full = left < capacityUsed;
              const active = slot.id === slotId;
              const projectEquipment = (project?.resources ?? []).map((resource) => ({
                name: resource,
                available: isProjectEquipmentAvailable(resource, equipment),
              }));
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
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:bg-accent/60",
                      full && "cursor-not-allowed opacity-50 hover:bg-card",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">{slot.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          left === 0
                            ? "bg-destructive/12 text-destructive"
                            : left <= 3
                              ? "bg-warning/15 text-warning-foreground"
                              : "bg-success/12 text-success",
                        )}
                      >
                        {left === 0 ? "Full" : `${left} spots left`}
                      </span>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {projectEquipment.map((e) => (
                        <li
                          key={e.name}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium",
                            e.available
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {e.name}: {e.available ? "Available" : "In use"}
                        </li>
                      ))}
                    </ul>
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
          className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Review reservation
        </button>
      </div>

      <SlotHistoryTimeline reservations={studentReservations} />

      <ResponsiveModal
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this reservation?"
        description="The reserved capacity will be released and the cancellation will remain in slot history."
      >
        <label className="block text-sm font-medium">
          Reason for cancellation
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Briefly tell the team why this booking is being cancelled"
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
          addReservation({
            projectId: project?.id ?? "",
            projectName: project?.name ?? "",
            date: selectedDate
              ? `${selectedDate.day}, ${selectedDate.date} ${selectedDate.month}`
              : "",
            slot: selectedSlot?.label ?? "",
            slotId: selectedSlot?.id,
            attendees: capacityUsed,
            participantIds: attending,
            status: "Active",
            resources,
          });
          setConfirmOpen(false);
          toast.success("Reservation confirmed");
        }}
      />
    </AppShell>
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
  index,
  title,
  aside,
  children,
}: {
  index: number;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5">
      <div className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {index}
        </span>
        <h2 className="truncate text-base font-semibold">{title}</h2>
        {aside && (
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{aside}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function SlotHistoryTimeline({ reservations }: { reservations: Reservation[] }) {
  const timeline = [...reservations].sort((a, b) => {
    if (a.status === "Active" && b.status === "Active") {
      return bookingDay(a.date) - bookingDay(b.date);
    }
    const activeDifference = Number(b.status === "Active") - Number(a.status === "Active");
    if (activeDifference) return activeDifference;
    return bookingDay(b.date) - bookingDay(a.date);
  });

  return (
    <section className="mt-8" aria-labelledby="slot-history-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Activity</p>
          <h2 id="slot-history-title" className="mt-1 text-lg font-semibold">
            Slot history timeline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmed sessions and previous reservation outcomes in one chronological view.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <History className="size-3.5" /> {timeline.length} records
        </span>
      </div>

      {timeline.length ? (
        <ol className="relative ml-3 space-y-4 border-l border-border pl-6 sm:ml-5 sm:pl-8">
          {timeline.map((reservation) => {
            const displayStatus =
              reservation.status === "Active"
                ? "Confirmed"
                : reservation.status === "No Show"
                  ? "No-Show"
                  : reservation.status;
            const active = reservation.status === "Active";
            return (
              <li key={reservation.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[2.05rem] top-5 grid size-4 place-items-center rounded-full border-[3px] border-background sm:-left-[2.55rem]",
                    active
                      ? "bg-primary shadow-[0_0_0_4px_rgba(56,81,194,0.10)]"
                      : reservation.status === "Completed"
                        ? "bg-success"
                        : reservation.status === "Cancelled"
                          ? "bg-muted-foreground"
                          : "bg-warning",
                  )}
                  aria-hidden
                />
                <article
                  className={cn(
                    "rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5",
                    active && "border-primary/25 bg-primary/[0.025]",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" /> {reservation.date}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-3.5" /> {reservation.slot}
                        </span>
                      </p>
                      <h3 className="mt-2 text-base font-semibold">{reservation.projectName}</h3>
                    </div>
                    <StatusBadge label={displayStatus} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                      <FolderKanban className="size-3.5" /> Project slot
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                      <Users className="size-3.5" /> {reservation.attendees}{" "}
                      {reservation.attendees === 1 ? "attendee" : "attendees"}
                    </span>
                  </div>

                  {(reservation.cancelledReason || reservation.noShowReason) && (
                    <p className="mt-4 rounded-xl bg-muted/70 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                      <strong className="text-foreground">
                        {reservation.status === "Cancelled"
                          ? "Cancellation reason:"
                          : "No-show note:"}
                      </strong>{" "}
                      {reservation.cancelledReason ?? reservation.noShowReason}
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="card-surface p-7 text-center text-sm text-muted-foreground">
          Your slot history will appear after the first reservation.
        </div>
      )}
    </section>
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
