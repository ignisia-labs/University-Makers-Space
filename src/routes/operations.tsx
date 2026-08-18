import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CalendarClock, DoorOpen, Footprints, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentUnitStatus,
  Project,
  Reservation,
} from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations — MIT-WPU MakerSpace" },
      { name: "description", content: "Sessions, visits and live equipment control." },
    ],
  }),
  component: OperationsPage,
});

const workspaces = [
  { id: "sessions", label: "Sessions", icon: CalendarClock },
  { id: "visits", label: "Visits", icon: Footprints },
  { id: "equipment", label: "Equipment", icon: Boxes },
] as const;

type WorkspaceId = (typeof workspaces)[number]["id"];

function OperationsPage() {
  const { reservations, visits, equipment } = useMakerSpace();
  const [workspace, setWorkspace] = useState<WorkspaceId>("sessions");

  const liveSessions = reservations.filter((r) => r.status === "Active").length;
  const inLab = reservations
    .filter((r) => r.status === "Active")
    .reduce(
      (total, r) =>
        total +
        Object.values(r.attendance ?? {}).filter((record) => record.status === "Entered").length,
      0,
    );
  const openVisits = visits.filter(
    (visit) => visit.type === "Quick Visit" && visit.status !== "Completed",
  ).length;
  const unitsFree = equipment.reduce((total, item) => total + item.availableQuantity, 0);

  return (
    <AppShell
      title="Operations"
      subtitle="Lab assistant workspace"
      workspaceNavigation={workspaces}
      activeWorkspace={workspace}
      onWorkspaceChange={(id) => setWorkspace(id as WorkspaceId)}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-3xl duration-500">
        <section
          aria-label="Lab at a glance"
          className="card-surface flex items-stretch divide-x divide-border px-2 py-4"
        >
          {[
            { label: "Booked sessions", value: String(liveSessions) },
            { label: "In the lab", value: String(inLab) },
            { label: "Open visits", value: String(openVisits) },
            { label: "Units free", value: String(unitsFree) },
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

        <div className="mt-8">
          {workspace === "sessions" && <SessionsDesk />}
          {workspace === "visits" && <VisitsDesk />}
          {workspace === "equipment" && <EquipmentDesk />}
        </div>
      </div>
    </AppShell>
  );
}

/* ── Sessions: entry desk + full slot history, date-wise ──────── */

function SessionsDesk() {
  const { reservations, projects, setBookingAttendance, cancelReservation, markReservationNoShow } =
    useMakerSpace();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [action, setAction] = useState<{ kind: "cancel" | "noshow"; booking: Reservation } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const upcoming = reservations.filter((reservation) => reservation.status === "Active");
  const past = reservations.filter((reservation) => reservation.status !== "Active");
  const shown = tab === "upcoming" ? upcoming : past;

  // Group by calendar date so the desk reads like a day sheet.
  const groups = new Map<string, Reservation[]>();
  shown.forEach((session) => {
    groups.set(session.date, [...(groups.get(session.date) ?? []), session]);
  });
  const ordered = [...groups.entries()].sort((a, b) =>
    tab === "upcoming" ? dayNumber(a[0]) - dayNumber(b[0]) : dayNumber(b[0]) - dayNumber(a[0]),
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Session views"
        className="inline-flex rounded-full border border-border bg-card p-1"
      >
        {(
          [
            { id: "upcoming", label: `Upcoming (${upcoming.length})` },
            { id: "past", label: `Past (${past.length})` },
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
        {ordered.length ? (
          ordered.map(([date, dateSessions]) => (
            <section key={date}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="font-serif text-xl font-light tracking-wide">{date}</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {dateSessions.length} {dateSessions.length === 1 ? "session" : "sessions"}
                </span>
              </div>
              <div className="space-y-4">
                {dateSessions.map((booking) =>
                  booking.status === "Active" ? (
                    <EntryCard
                      key={booking.id}
                      booking={booking}
                      project={projects.find((project) => project.id === booking.projectId)}
                      onMark={(participantIds, status) => {
                        setBookingAttendance(booking.id, participantIds, status);
                        toast.success(status === "Entered" ? "Entry permitted" : "Exit recorded");
                      }}
                      onCancel={() => {
                        setAction({ kind: "cancel", booking });
                        setReason("");
                      }}
                      onNoShow={() => {
                        setAction({ kind: "noshow", booking });
                        setReason("");
                      }}
                    />
                  ) : (
                    <PastSessionRow key={booking.id} booking={booking} />
                  ),
                )}
              </div>
            </section>
          ))
        ) : (
          <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
            {tab === "upcoming"
              ? "Booked sessions will appear here for entry management."
              : "Completed and cancelled sessions will collect here."}
          </div>
        )}
      </div>

      <ResponsiveModal
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.kind === "cancel" ? "Cancel this session?" : "Mark as no-show?"}
        description={
          action?.kind === "cancel"
            ? "The reserved capacity is released and the team is notified."
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
          disabled={!reason.trim()}
          onClick={() => {
            if (!action) return;
            if (action.kind === "cancel") cancelReservation(action.booking.id, reason.trim());
            else markReservationNoShow(action.booking.id, reason.trim());
            setAction(null);
            toast.success(action.kind === "cancel" ? "Session cancelled" : "Marked no-show");
          }}
          className="pressable mt-5 min-h-12 w-full rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          Confirm
        </button>
      </ResponsiveModal>
    </div>
  );
}

function EntryCard({
  booking,
  project,
  onMark,
  onCancel,
  onNoShow,
}: {
  booking: Reservation;
  project: Project | undefined;
  onMark: (participantIds: string[], status: "Entered" | "Exited") => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const participantName = (id: string) =>
    id === "leader"
      ? (project?.leader ?? "Team leader")
      : (project?.members.find((member) => member.id === id)?.name ?? "Team member");
  const inside = booking.participantIds.filter(
    (id) => booking.attendance?.[id]?.status === "Entered",
  ).length;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg font-light tracking-wide">
            {booking.projectName}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <DoorOpen className="size-3" /> {booking.slot}
            {inside > 0 && <span className="text-primary">· {inside} in the lab</span>}
          </p>
        </div>
        <StatusBadge label="Confirmed" />
      </div>

      <ul className="divide-y divide-border/60 px-5">
        {booking.participantIds.map((participantId) => {
          const record = booking.attendance?.[participantId];
          const status = record?.status ?? "Expected";
          return (
            <li
              key={participantId}
              className="flex min-h-12 items-center justify-between gap-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    status === "Entered"
                      ? "bg-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                      : status === "Exited"
                        ? "bg-primary/50"
                        : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{participantName(participantId)}</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {status === "Entered"
                      ? `In since ${record?.enteredAt ?? ""}`
                      : status === "Exited"
                        ? `Out at ${record?.exitedAt ?? ""}`
                        : "Expected"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {status === "Expected" && (
                  <button
                    type="button"
                    onClick={() => onMark([participantId], "Entered")}
                    className="pressable min-h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Permit entry
                  </button>
                )}
                {status === "Entered" && (
                  <button
                    type="button"
                    onClick={() => onMark([participantId], "Exited")}
                    className="pressable min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
                  >
                    Mark exit
                  </button>
                )}
                {status === "Exited" && (
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

function PastSessionRow({ booking }: { booking: Reservation }) {
  return (
    <article className="card-surface flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{booking.projectName}</p>
        <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {booking.slot} · {booking.attendees} {booking.attendees === 1 ? "attendee" : "attendees"}
          {booking.resources.length > 0 && ` · ${booking.resources.join(", ")}`}
        </p>
        {(booking.cancelledReason || booking.noShowReason) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {booking.cancelledReason ?? booking.noShowReason}
          </p>
        )}
      </div>
      <StatusBadge
        label={booking.status === "No Show" ? "No-Show" : booking.status}
        className="shrink-0"
      />
    </article>
  );
}

/* ── Visits: permit and close quick visits ────────────────────── */

function VisitsDesk() {
  const { visits, updateVisit } = useMakerSpace();
  // Only guest / quick visits are managed here — project sessions live on the Sessions desk.
  const guestVisits = visits.filter((visit) => visit.type === "Quick Visit");
  const open = guestVisits.filter((visit) => visit.status !== "Completed");
  const done = guestVisits.filter((visit) => visit.status === "Completed");
  const now = () =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
          Waiting at the desk
        </p>
        {open.length ? (
          <div className="card-surface divide-y divide-border overflow-hidden">
            {open.map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "relative grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary",
                    )}
                  >
                    <Footprints className="size-4.5" />
                    {visit.status === "Active" && (
                      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{visit.title}</p>
                    <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {visit.date} · from {visit.entry}
                      {visit.expectedDuration && ` · ~${visit.expectedDuration}`} ·{" "}
                      {visit.status === "Active" ? "in the lab" : "awaiting entry"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {visit.status === "Requested" ? (
                    <button
                      type="button"
                      onClick={() => {
                        updateVisit(visit.id, { status: "Active", entry: now() });
                        toast.success("Visit permitted");
                      }}
                      className="pressable min-h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Permit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        updateVisit(visit.id, { status: "Completed", exit: now() });
                        toast.success("Visit closed");
                      }}
                      className="pressable min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
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
            {done.slice(0, 10).map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{visit.title}</p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {visit.date} · in {visit.entry} · out {visit.exit ?? "—"}
                  </p>
                </div>
                <StatusBadge label={visit.type} className="shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Equipment: live control room ─────────────────────────────── */

function EquipmentDesk() {
  const { equipment, uploads, updateEquipment, removeUpload } = useMakerSpace();

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {equipment
        .filter((item) => item.visible)
        .map((item) => (
          <EquipmentCard
            key={item.id}
            item={item}
            queued={uploads.filter((upload) => upload.equipmentId === item.id)}
            onPatch={(patch, message) => {
              updateEquipment(item.id, patch);
              toast.success(message);
            }}
            onRemoveUpload={(id) => {
              removeUpload(id);
              toast.success("File removed from queue");
            }}
          />
        ))}
    </div>
  );
}

function EquipmentCard({
  item,
  queued,
  onPatch,
  onRemoveUpload,
}: {
  item: Equipment;
  queued: ReturnType<typeof useMakerSpace>["uploads"];
  onPatch: (patch: Partial<Equipment>, message: string) => void;
  onRemoveUpload: (id: string) => void;
}) {
  const usable = item.status === "Available" || item.status === "Partially Available";
  // Each physical unit carries its own status; older saved state derives a set.
  const units: EquipmentUnitStatus[] =
    item.units && item.units.length === item.totalQuantity
      ? item.units
      : Array.from({ length: item.totalQuantity }, (_, index) =>
          index < item.availableQuantity
            ? "Available"
            : item.status === "Under Maintenance"
              ? "Under Maintenance"
              : "In Use",
        );
  const freeCount = units.filter((unit) => unit === "Available").length;
  const cycle: Record<EquipmentUnitStatus, EquipmentUnitStatus> = {
    Available: "In Use",
    "In Use": "Under Maintenance",
    "Under Maintenance": "Available",
  };
  const setUnit = (index: number, next: EquipmentUnitStatus) => {
    const nextUnits = units.map((unit, i) => (i === index ? next : unit));
    const free = nextUnits.filter((unit) => unit === "Available").length;
    const aggregate: EquipmentStatus =
      free === nextUnits.length
        ? "Available"
        : free > 0
          ? "Partially Available"
          : nextUnits.every((unit) => unit === "Under Maintenance")
            ? "Under Maintenance"
            : "In Use";
    onPatch(
      {
        units: nextUnits,
        availableQuantity: free,
        status: aggregate,
        ...(next === "Under Maintenance" ? { availabilityReason: "Marked by lab assistant" } : {}),
      },
      `${item.name} · Unit ${index + 1} → ${next}`,
    );
  };

  return (
    <article className="card-surface overflow-hidden">
      <div className="relative aspect-[5/2] overflow-hidden bg-muted">
        <img src={item.image} alt={item.name} className="size-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute left-3 top-3">
          <StatusBadge label={item.status} className="bg-card/90 backdrop-blur" />
        </span>
        <span className="absolute inset-x-0 bottom-0 p-3.5">
          <span className="block truncate font-serif text-lg font-light text-white">
            {item.name}
          </span>
          <span className="mt-0.5 block text-[10px] font-mono uppercase tracking-widest text-white/70">
            {item.category} · {item.lab}
          </span>
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Units · tap to change status
          </p>
          <p className="font-mono text-xs font-semibold text-primary">
            {freeCount}/{item.totalQuantity} free
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              usable ? "bg-primary" : "bg-muted-foreground/40",
            )}
            style={{
              width: `${Math.round((freeCount / Math.max(1, item.totalQuantity)) * 100)}%`,
            }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {units.map((unit, index) => (
            <button
              key={index}
              type="button"
              title={`Unit ${index + 1}: ${unit} — tap to change`}
              onClick={() => setUnit(index, cycle[unit])}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 transition-colors",
                unit === "Available"
                  ? "border-primary/25 bg-primary/[0.06] text-primary hover:border-primary/50"
                  : unit === "In Use"
                    ? "border-border bg-muted text-muted-foreground hover:border-primary/40"
                    : "border-warning/40 bg-warning/10 text-warning-foreground hover:border-warning/70",
              )}
            >
              <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">
                Unit {index + 1}
              </span>
              <span className="text-[10px] font-semibold">
                {unit === "Available" ? "Free" : unit === "In Use" ? "In use" : "Maint."}
              </span>
            </button>
          ))}
        </div>

        {item.availabilityReason && item.status !== "Available" && (
          <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-5 text-warning-foreground">
            {item.availabilityReason}
          </p>
        )}

        {queued.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              Queued files
            </p>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {queued.map((upload) => (
                <li key={upload.id} className="flex items-center gap-3 px-3.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{upload.fileName}</span>
                    <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                      {upload.ownerEmail} · {upload.uploadedAt}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${upload.fileName}`}
                    onClick={() => onRemoveUpload(upload.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

function dayNumber(date: string) {
  return Number(date.match(/\b(\d{1,2})\b/)?.[1] ?? 0);
}
