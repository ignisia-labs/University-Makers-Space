import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CalendarClock, DoorOpen, Footprints } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import type { Equipment, EquipmentStatus, Project, Reservation } from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations — MIT-WPU MakerSpace" },
      { name: "description", content: "Entry desk, visits, equipment and slot overview." },
    ],
  }),
  component: OperationsPage,
});

const workspaces = [
  { id: "entry", label: "Entry desk", icon: DoorOpen },
  { id: "visits", label: "Visits", icon: Footprints },
  { id: "equipment", label: "Equipment", icon: Boxes },
  { id: "slots", label: "Slots", icon: CalendarClock },
] as const;

type WorkspaceId = (typeof workspaces)[number]["id"];

function OperationsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceId>("entry");

  return (
    <AppShell
      title="Operations"
      subtitle="Lab assistant workspace"
      workspaceNavigation={workspaces}
      activeWorkspace={workspace}
      onWorkspaceChange={(id) => setWorkspace(id as WorkspaceId)}
    >
      <div className="mx-auto max-w-3xl">
        {workspace === "entry" && <EntryDesk />}
        {workspace === "visits" && <VisitsDesk />}
        {workspace === "equipment" && <EquipmentDesk />}
        {workspace === "slots" && <SlotsOverview />}
      </div>
    </AppShell>
  );
}

/* ── Entry desk: permit / cancel entry for booked sessions ────── */

function EntryDesk() {
  const { reservations, projects, setBookingAttendance, cancelReservation, markReservationNoShow } =
    useMakerSpace();
  const active = reservations.filter((reservation) => reservation.status === "Active");
  const [action, setAction] = useState<{ kind: "cancel" | "noshow"; booking: Reservation } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  if (!active.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        Booked sessions will appear here for entry management.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active.map((booking) => (
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
      ))}

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

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-lg font-light tracking-wide">
            {booking.projectName}
          </h2>
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {booking.date} · {booking.slot}
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

/* ── Visits: permit and close quick visits ────────────────────── */

function VisitsDesk() {
  const { visits, updateVisit } = useMakerSpace();
  const open = visits.filter((visit) => visit.status !== "Completed");
  const done = visits.filter((visit) => visit.status === "Completed");
  const now = () =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
          Open visits
        </p>
        {open.length ? (
          <div className="card-surface divide-y divide-border overflow-hidden">
            {open.map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{visit.title}</p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {visit.date} · in {visit.entry} · {visit.type} · {visit.status}
                  </p>
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
            Quick-visit requests will appear here.
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
            Completed
          </p>
          <div className="card-surface divide-y divide-border overflow-hidden">
            {done.slice(0, 8).map((visit) => (
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

/* ── Equipment: set live availability ─────────────────────────── */

const quickStatuses: EquipmentStatus[] = ["Available", "In Use", "Under Maintenance"];

function EquipmentDesk() {
  const { equipment, updateEquipment } = useMakerSpace();

  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {equipment
        .filter((item) => item.visible)
        .map((item) => (
          <EquipmentRow
            key={item.id}
            item={item}
            onStatus={(status) => {
              updateEquipment(item.id, {
                status,
                availableQuantity: status === "Available" ? item.totalQuantity : 0,
                ...(status === "Under Maintenance"
                  ? { availabilityReason: "Marked by lab assistant" }
                  : {}),
              });
              toast.success(`${item.name} → ${status}`);
            }}
          />
        ))}
    </div>
  );
}

function EquipmentRow({
  item,
  onStatus,
}: {
  item: Equipment;
  onStatus: (status: EquipmentStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {item.category} · {item.lab} · {item.availableQuantity} of {item.totalQuantity} free
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {quickStatuses.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={item.status === status}
            onClick={() => item.status !== status && onStatus(status)}
            className={cn(
              "min-h-9 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
              item.status === status
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {status}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Slots: every reservation, future and past ────────────────── */

function SlotsOverview() {
  const { reservations } = useMakerSpace();
  const upcoming = reservations.filter((reservation) => reservation.status === "Active");
  const past = reservations.filter((reservation) => reservation.status !== "Active");

  const Group = ({ label, items }: { label: string; items: Reservation[] }) => (
    <section>
      <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">{label}</p>
      {items.length ? (
        <div className="card-surface divide-y divide-border overflow-hidden">
          {items.map((reservation) => (
            <div key={reservation.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{reservation.projectName}</p>
                <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {reservation.date} · {reservation.slot} · {reservation.attendees}{" "}
                  {reservation.attendees === 1 ? "attendee" : "attendees"}
                  {reservation.resources.length > 0 && ` · ${reservation.resources.join(", ")}`}
                </p>
              </div>
              <StatusBadge
                label={reservation.status === "Active" ? "Confirmed" : reservation.status}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="card-surface px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <Group label="Upcoming" items={upcoming} />
      <Group label="Past" items={past} />
    </div>
  );
}
