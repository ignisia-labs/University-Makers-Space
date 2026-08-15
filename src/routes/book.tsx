import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SlotBookingModal } from "@/components/Booking/SlotBookingModal";
import { Checkbox } from "@/components/ui/checkbox";
import { useMakerSpace } from "@/lib/makerspace-context";
import { bookingDates, timeSlots } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";
import { requireRoles } from "@/lib/auth-guards";

export const Route = createFileRoute("/book")({
  beforeLoad: requireRoles("STUDENT"),
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
  const { projects, profile, reservations, addReservation, cancelReservation } = useMakerSpace();
  const verified = projects.filter((p) => p.status === "Verified");
  const [projectId, setProjectId] = useState(verified[0]?.id ?? "");
  const project = verified.find((p) => p.id === projectId);
  const [attending, setAttending] = useState<string[]>(["leader"]);
  const [dateId, setDateId] = useState(bookingDates[0]!.id);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const selectedDate = bookingDates.find((d) => d.id === dateId)!;
  const selectedSlot = timeSlots.find((s) => s.id === slotId);
  const capacityUsed = attending.length;

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
        {reservations
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
                  onClick={() =>
                    cancelReservation(reservation.id, cancelReason || "Cancelled by team leader")
                  }
                  className="min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive hover:bg-destructive/10"
                >
                  Cancel booking
                </button>
              </div>
              <input
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Cancellation reason (optional)"
                className="mt-4 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
              />
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
                    {p.members.length + 1} members · {p.mentor}
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
                  onClick={() => setDateId(d.id)}
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
            {timeSlots.map((slot) => {
              const left = slot.capacity - slot.booked;
              const full = left < capacityUsed;
              const active = slot.id === slotId;
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
                      {slot.equipment.map((e) => (
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

      <SlotBookingModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        projectName={project?.name ?? "—"}
        date={`${selectedDate.day}, ${selectedDate.date} ${selectedDate.month}`}
        slot={selectedSlot?.label ?? "—"}
        attendees={capacityUsed}
        projectResources={project?.resources ?? []}
        onConfirm={(resources) => {
          addReservation({
            projectId: project?.id ?? "",
            projectName: project?.name ?? "",
            date: `${selectedDate.day}, ${selectedDate.date} ${selectedDate.month}`,
            slot: selectedSlot?.label ?? "",
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
