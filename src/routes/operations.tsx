import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  CalendarClock,
  DoorClosed,
  DoorOpen,
  FolderKanban,
  Footprints,
  RadioTower,
  Search,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import {
  directoryStudents,
  type Equipment,
  type EquipmentStatus,
  type Reservation,
} from "@/lib/makerspace-data";

export const Route = createFileRoute("/operations")({ component: Operations });

const equipmentStatuses: EquipmentStatus[] = [
  "Available",
  "Partially Available",
  "In Use",
  "Reserved",
  "Unavailable",
  "Under Maintenance",
  "Damaged",
  "Out of Service",
];
type OperationsView = "live" | "bookings" | "visits" | "equipment" | "projects";
const operationsViews = [
  { id: "live", label: "Live", icon: RadioTower },
  { id: "bookings", label: "Bookings", icon: CalendarClock },
  { id: "visits", label: "Visits", icon: Footprints },
  { id: "equipment", label: "Equipment", icon: Boxes },
  { id: "projects", label: "Projects", icon: FolderKanban },
];

function Operations() {
  const {
    reservations,
    projects,
    visits,
    equipment,
    config,
    setBookingAttendance,
    addBookingParticipant,
    markReservationNoShow,
    cancelReservation,
    updateEquipment,
  } = useMakerSpace();
  const [view, setView] = useState<OperationsView>("live");
  const [action, setAction] = useState<{ booking: Reservation; type: "no-show" | "cancel" } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [equipmentItem, setEquipmentItem] = useState<Equipment | null>(null);
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus>("Available");
  const [equipmentReason, setEquipmentReason] = useState("");
  const [equipmentReasonCategory, setEquipmentReasonCategory] = useState<
    "Maintenance" | "Damage" | "Temporary Issue" | "Other"
  >("Maintenance");

  const active = reservations.filter((booking) => booking.status === "Active");
  const entered = active.reduce(
    (total, booking) =>
      total +
      Object.values(booking.attendance ?? {}).filter((record) => record.status === "Entered")
        .length,
    0,
  );
  const expected = active.reduce((total, booking) => total + booking.attendees, 0);
  const participantsFor = (booking: Reservation) => {
    const project = projects.find((item) => item.id === booking.projectId);
    const projectPeople = project
      ? [
          { id: "leader", name: project.leader },
          ...project.members.map((member) => ({ id: member.id, name: member.name })),
        ]
      : [];
    const people = [
      ...projectPeople,
      ...directoryStudents
        .filter((student) => !projectPeople.some((person) => person.id === student.id))
        .map((student) => ({ id: student.id, name: student.name })),
    ];
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
    setEquipmentReasonCategory(item.availabilityReasonCategory ?? "Maintenance");
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
      availabilityReasonCategory:
        equipmentStatus === "Available" ? undefined : equipmentReasonCategory,
      availabilityReason:
        equipmentStatus === "Available" ? undefined : equipmentReason.trim() || undefined,
    };
    updateEquipment(equipmentItem.id, patch);
    setEquipmentItem(null);
  }

  return (
    <AppShell
      title={operationsViews.find((item) => item.id === view)?.label ?? "Live"}
      subtitle="Lab Assistant console"
      workspaceNavigation={operationsViews}
      activeWorkspace={view}
      onWorkspaceChange={(id) => setView(id as OperationsView)}
    >
      {view === "live" && (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Live laboratory occupancy">
            <Metric
              value={`${entered} / ${config.capacity}`}
              label="Present now"
              note={`${expected} expected across current slots`}
            />
            <Metric
              value={active.length}
              label="Active slot bookings"
              note="Expected teams today"
            />
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
                    onAddParticipant={addBookingParticipant}
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
        </>
      )}

      {view === "equipment" && (
        <section>
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
                    <p className="mt-2 text-xs text-warning-foreground">
                      {item.availabilityReason}
                    </p>
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
      )}

      {view === "bookings" && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Booking operations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Current, cancelled and no-show booking records.
            </p>
          </div>
          {reservations.map((booking) => (
            <article key={booking.id} className="card-surface p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{booking.projectName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {booking.date} · {booking.slot} · {booking.attendees} expected
                  </p>
                </div>
                <StatusBadge label={booking.status} />
              </div>
              {(booking.cancelledReason || booking.noShowReason) && (
                <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
                  <strong>Operational record:</strong>{" "}
                  {booking.cancelledReason ?? booking.noShowReason}
                  <span className="block mt-1 text-xs text-muted-foreground">
                    {booking.handledBy} · {booking.cancelledAt ?? booking.noShowAt}
                  </span>
                </p>
              )}
            </article>
          ))}
        </section>
      )}

      {view === "visits" && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Operational visits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Project-slot and quick-visit attendance records.
            </p>
          </div>
          {visits.map((visit) => (
            <article
              key={visit.id}
              className="card-surface flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-semibold">{visit.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {visit.type} · {visit.date} · Entry {visit.entry}
                  {visit.exit ? ` · Exit ${visit.exit}` : ""}
                </p>
              </div>
              <StatusBadge label={visit.status} />
            </article>
          ))}
        </section>
      )}

      {view === "projects" && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Project directory</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Operational context for teams using MakerSpace.
            </p>
          </div>
          {projects.map((project) => (
            <article key={project.id} className="card-surface p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Team Leader: {project.leader} · {project.members.length + 1} members
                  </p>
                </div>
                <StatusBadge label={project.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{project.resources.join(", ")}</p>
            </article>
          ))}
        </section>
      )}

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
          <select
            aria-label="Availability reason category"
            value={equipmentReasonCategory}
            onChange={(event) =>
              setEquipmentReasonCategory(
                event.target.value as "Maintenance" | "Damage" | "Temporary Issue" | "Other",
              )
            }
            className="form-input"
          >
            <option>Maintenance</option>
            <option>Damage</option>
            <option>Temporary Issue</option>
            <option>Other</option>
          </select>
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
  onAddParticipant,
  onException,
}: {
  booking: Reservation;
  participants: { id: string; name: string }[];
  onAttendance: (id: string, people: string[], status: "Expected" | "Entered" | "Exited") => void;
  onAddParticipant: (bookingId: string, participantId: string) => void;
  onException: (type: "no-show" | "cancel") => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const entered = participants.filter(
    (person) => booking.attendance?.[person.id]?.status === "Entered",
  ).length;
  const fallbackResults = search.trim()
    ? directoryStudents.filter(
        (student) =>
          !booking.participantIds.includes(student.id) &&
          `${student.name} ${student.email ?? ""} ${student.prn}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : [];
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
          const record = booking.attendance?.[person.id];
          const status = record?.status ?? "Expected";
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
                <span>
                  <span className="block text-sm font-medium">{person.name}</span>
                  {(record?.enteredAt || record?.exitedAt) && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {record.enteredAt ? `Entered ${record.enteredAt}` : ""}
                      {record.exitedAt ? ` · Exited ${record.exitedAt}` : ""}
                      {record.markedBy ? ` · ${record.markedBy}` : ""}
                    </span>
                  )}
                </span>
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
          onClick={() => apply("Exited", true)}
          className="min-h-11 rounded-xl border px-3 text-sm font-semibold"
        >
          Check out team
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
      <details className="mt-4 border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-primary">
          Find another student
        </summary>
        <label className="relative mt-3 block">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or PRN"
            className="form-input pl-10"
          />
        </label>
        {fallbackResults.length > 0 && (
          <div className="mt-2 divide-y rounded-xl border">
            {fallbackResults.slice(0, 4).map((student) => (
              <div
                key={student.id}
                className="flex min-h-12 items-center justify-between gap-3 px-3"
              >
                <div>
                  <p className="text-sm font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.prn} · {student.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAddParticipant(booking.id, student.id);
                    setSearch("");
                  }}
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Add to roster
                </button>
              </div>
            ))}
          </div>
        )}
      </details>
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
