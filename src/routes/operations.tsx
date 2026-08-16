import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, DoorClosed, DoorOpen, MonitorCog, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Equipment, EquipmentStatus, Reservation } from "@/lib/makerspace-data";

export const Route = createFileRoute("/operations")({ component: Operations });

const equipmentStatuses: EquipmentStatus[] = [
  "Available",
  "Under Maintenance",
  "Damaged",
  "Out of Service",
];

function Operations() {
  const {
    reservations,
    projects,
    equipment,
    config,
    setBookingAttendance,
    markReservationNoShow,
    cancelReservation,
    updateEquipment,
  } = useMakerSpace();
  const [action, setAction] = useState<{ booking: Reservation; type: "no-show" | "cancel" } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [equipmentItem, setEquipmentItem] = useState<Equipment | null>(null);
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus>("Available");
  const [equipmentReason, setEquipmentReason] = useState("");

  const active = reservations.filter((booking) => booking.status === "Active");
  const entered = active.reduce(
    (total, booking) =>
      total +
      Object.values(booking.attendance ?? {}).filter((status) => status === "Entered").length,
    0,
  );
  const expected = active.reduce((total, booking) => total + booking.attendees, 0);
  const participantsFor = (booking: Reservation) => {
    const project = projects.find((item) => item.id === booking.projectId);
    const people = project
      ? [
          { id: "leader", name: project.leader },
          ...project.members.map((member) => ({ id: member.id, name: member.name })),
        ]
      : [];
    return people.filter((person) => booking.participantIds.includes(person.id));
  };
  const openEquipment = (item: Equipment) => {
    setEquipmentItem(item);
    setEquipmentStatus(
      item.status === "Partially Available" ||
        item.status === "In Use" ||
        item.status === "Reserved" ||
        item.status === "Unavailable"
        ? "Available"
        : item.status,
    );
    setEquipmentReason(item.availabilityReason ?? "");
  };
  function confirmBookingAction() {
    if (!action) return;
    if (!reason.trim()) {
      setReasonError("A reason is required for an operational no-show or cancellation.");
      return;
    }
    if (action.type === "no-show") markReservationNoShow(action.booking.id, reason.trim());
    else cancelReservation(action.booking.id, reason.trim());
    setAction(null);
    setReason("");
  }
  function saveEquipmentStatus() {
    if (!equipmentItem) return;
    if (equipmentStatus !== "Available" && !equipmentReason.trim()) return;
    const patch: Partial<Equipment> = {
      status: equipmentStatus,
      availableQuantity: equipmentStatus === "Available" ? equipmentItem.totalQuantity : 0,
    };
    if (equipmentReason.trim()) patch.availabilityReason = equipmentReason.trim();
    updateEquipment(equipmentItem.id, patch);
    setEquipmentItem(null);
  }

  return (
    <AppShell title="Live operations" subtitle="Lab Assistant console">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Live laboratory occupancy">
        <Metric
          value={`${entered} / ${config.capacity}`}
          label="Present now"
          note={`${expected} expected across current slots`}
        />
        <Metric value={active.length} label="Active slot bookings" note="Expected teams today" />
        <Metric
          value={equipment.filter((item) => item.status !== "Available").length}
          label="Equipment alerts"
          note="Items needing attention"
        />
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold">Current slot operations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mark individual attendance, then record exceptions with an accountable reason.
            </p>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:block">
            Live capacity: {entered}/{config.capacity}
          </span>
        </div>
        <div className="mt-3 space-y-4">
          {active.length ? (
            active.map((booking) => (
              <BookingOperations
                key={booking.id}
                booking={booking}
                participants={participantsFor(booking)}
                onAttendance={setBookingAttendance}
                onException={(type) => {
                  setAction({ booking, type });
                  setReason("");
                  setReasonError("");
                }}
              />
            ))
          ) : (
            <EmptyOperations />
          )}
        </div>
      </section>

      <section className="mt-8">
        <div>
          <h2 className="font-semibold">Equipment health</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fast operational updates immediately change equipment availability in this prototype.
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {equipment.map((item) => (
            <article
              key={item.id}
              className="card-surface flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.availableQuantity}/{item.totalQuantity} available
                </p>
                <div className="mt-2">
                  <StatusBadge label={item.status} />
                </div>
                {item.availabilityReason && (
                  <p className="mt-2 text-xs text-warning-foreground">{item.availabilityReason}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => openEquipment(item)}
                className="min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold"
              >
                Update health
              </button>
            </article>
          ))}
        </div>
      </section>

      <ResponsiveModal
        open={!!action}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action?.type === "no-show" ? "Mark booking as no-show" : "Cancel operational booking"
        }
        description="This action releases the booking from active operations and is recorded in the audit trail."
      >
        <div className="space-y-3">
          <label htmlFor="operations-reason" className="block text-sm font-medium">
            Required reason
          </label>
          <textarea
            id="operations-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError("");
            }}
            className="min-h-28 w-full rounded-xl border bg-card p-3 text-sm"
            placeholder="Describe what occurred during the slot."
            aria-invalid={!!reasonError}
          />
          {reasonError && <p className="text-sm text-destructive">{reasonError}</p>}
          <button
            type="button"
            onClick={confirmBookingAction}
            className="min-h-12 w-full rounded-xl bg-destructive font-semibold text-destructive-foreground"
          >
            Confirm {action?.type === "no-show" ? "no-show" : "cancellation"}
          </button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={!!equipmentItem}
        onOpenChange={(open) => !open && setEquipmentItem(null)}
        title={`Update ${equipmentItem?.name ?? "equipment"}`}
        description="Record a current operational health state. A non-available status needs a reason."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {equipmentStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setEquipmentStatus(status)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${equipmentStatus === status ? "border-primary bg-primary/10 text-primary" : ""}`}
              >
                {status}
              </button>
            ))}
          </div>
          <label htmlFor="equipment-reason" className="block text-sm font-medium">
            Operational note {equipmentStatus !== "Available" ? "(required)" : "(optional)"}
          </label>
          <textarea
            id="equipment-reason"
            value={equipmentReason}
            onChange={(event) => setEquipmentReason(event.target.value)}
            className="min-h-24 w-full rounded-xl border bg-card p-3 text-sm"
            placeholder="For example, awaiting calibration by supplier."
          />
          <button
            type="button"
            onClick={saveEquipmentStatus}
            disabled={equipmentStatus !== "Available" && !equipmentReason.trim()}
            className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save equipment health
          </button>
        </div>
      </ResponsiveModal>
    </AppShell>
  );
}

function BookingOperations({
  booking,
  participants,
  onAttendance,
  onException,
}: {
  booking: Reservation;
  participants: { id: string; name: string }[];
  onAttendance: (id: string, people: string[], status: "Expected" | "Entered" | "Exited") => void;
  onException: (type: "no-show" | "cancel") => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const entered = participants.filter(
    (person) => booking.attendance?.[person.id] === "Entered",
  ).length;
  const toggle = (personId: string) =>
    setSelected((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  const apply = (status: "Entered" | "Exited", all = false) => {
    const ids = all ? participants.map((person) => person.id) : selected;
    if (!ids.length) return;
    onAttendance(booking.id, ids, status);
    setSelected([]);
  };
  return (
    <article className="card-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{booking.projectName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.date} · {booking.slot} · {entered}/{booking.attendees} arrived
          </p>
        </div>
        <StatusBadge label={booking.status} />
      </div>
      <div className="mt-4 divide-y rounded-xl border">
        {participants.map((person) => {
          const status = booking.attendance?.[person.id] ?? "Expected";
          return (
            <label
              key={person.id}
              className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3"
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(person.id)}
                  onChange={() => toggle(person.id)}
                  className="size-4 accent-primary"
                  aria-label={`Select ${person.name}`}
                />
                <span className="text-sm font-medium">{person.name}</span>
              </span>
              <StatusBadge label={status} />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => apply("Entered")}
          disabled={!selected.length}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          <DoorOpen className="size-4" />
          Check in selected
        </button>
        <button
          type="button"
          onClick={() => apply("Entered", true)}
          className="min-h-11 rounded-xl border px-3 text-sm font-semibold"
        >
          Check in team
        </button>
        <button
          type="button"
          onClick={() => apply("Exited")}
          disabled={!selected.length}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"
        >
          <DoorClosed className="size-4" />
          Check out selected
        </button>
        <button
          type="button"
          onClick={() => onException("no-show")}
          className="min-h-11 rounded-xl border border-warning/50 px-3 text-sm font-semibold text-warning-foreground"
        >
          No-show
        </button>
        <button
          type="button"
          onClick={() => onException("cancel")}
          className="min-h-11 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive"
        >
          Cancel booking
        </button>
      </div>
    </article>
  );
}
function Metric({ value, label, note }: { value: string | number; label: string; note: string }) {
  return (
    <article className="card-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 font-semibold text-sm">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}
function EmptyOperations() {
  return (
    <div className="card-surface p-8 text-center">
      <UsersRound className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 font-semibold">No active slots right now</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Upcoming bookings will become available here when their slot begins.
      </p>
    </div>
  );
}
