import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  FlaskConical,
  LayoutDashboard,
  PackagePlus,
  Pencil,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import type {
  Consumable,
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
  LabConfig,
} from "@/lib/makerspace-data";

export const Route = createFileRoute("/admin")({ component: Admin });

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
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type AdminView = "dashboard" | "equipment" | "consumables" | "config";
const adminViews = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "equipment", label: "Equipment", icon: Boxes },
  { id: "consumables", label: "Consumables", icon: FlaskConical },
  { id: "config", label: "Lab Config", icon: Settings2 },
] as const;

function emptyEquipment(): Omit<Equipment, "id"> {
  return {
    name: "",
    category: "Electronics",
    status: "Available",
    image: "",
    specs: [],
    description: "",
    totalQuantity: 1,
    availableQuantity: 1,
    visible: true,
    bookingVisible: true,
    notes: "",
    lab: "Main MakerSpace",
    createdAt: new Date().toLocaleDateString("en-IN"),
    updatedAt: new Date().toLocaleDateString("en-IN"),
  };
}
function emptyConsumable(): Omit<Consumable, "id"> {
  return { name: "", category: "Electronics", description: "", unit: "Unit", active: true };
}

function Admin() {
  const {
    config,
    saveConfig,
    equipment,
    consumables,
    updateEquipment,
    addEquipment,
    removeEquipment,
    addConsumable,
    updateConsumable,
    removeConsumable,
    reservations,
    visits,
    projects,
    auditLogs,
    equipmentCategories,
    addEquipmentCategory,
  } = useMakerSpace();
  const [view, setView] = useState<AdminView>("dashboard");
  const [draft, setDraft] = useState(config);
  const catalogue = view === "consumables" ? "consumables" : "equipment";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [equipmentModal, setEquipmentModal] = useState<{
    item: Omit<Equipment, "id">;
    id?: string;
  } | null>(null);
  const [consumableModal, setConsumableModal] = useState<{
    item: Omit<Consumable, "id">;
    id?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "equipment" | "consumable";
    id: string;
    name: string;
  } | null>(null);
  const [closureInput, setClosureInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const present = reservations.reduce(
    (total, booking) =>
      total +
      Object.values(booking.attendance ?? {}).filter((record) => record.status === "Entered")
        .length,
    0,
  );
  const activeBookings = reservations.filter((booking) => booking.status === "Active");
  const bookedSeats = activeBookings.reduce((total, booking) => total + booking.attendees, 0);
  const utilization = activeBookings.length
    ? Math.round((bookedSeats / (activeBookings.length * config.capacity)) * 100)
    : 0;

  const shownEquipment = useMemo(
    () =>
      equipment.filter(
        (item) =>
          (category === "All" || item.category === category) &&
          `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [equipment, category, query],
  );
  const shownConsumables = useMemo(
    () =>
      consumables.filter(
        (item) =>
          (category === "All" || item.category === category) &&
          `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [consumables, category, query],
  );
  const updateDraft = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  function saveSettings() {
    saveConfig(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }
  function saveEquipment() {
    if (!equipmentModal?.item.name.trim()) return;
    if (equipmentModal.id) updateEquipment(equipmentModal.id, equipmentModal.item);
    else addEquipment(equipmentModal.item);
    setEquipmentModal(null);
  }
  function saveConsumable() {
    if (!consumableModal?.item.name.trim()) return;
    if (consumableModal.id) updateConsumable(consumableModal.id, consumableModal.item);
    else addConsumable(consumableModal.item);
    setConsumableModal(null);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "equipment") removeEquipment(deleteTarget.id);
    else removeConsumable(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <AppShell
      title={adminViews.find((item) => item.id === view)?.label ?? "Dashboard"}
      subtitle="MakerSpace administration"
      workspaceNavigation={adminViews}
      activeWorkspace={view}
      onWorkspaceChange={(id) => {
        setView(id as AdminView);
        setCategory("All");
        setQuery("");
      }}
    >
      {view === "dashboard" && (
        <section id="admin-overview">
          <h2 className="font-semibold">Operational overview</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetric
              label="Current occupancy"
              value={`${present}/${config.capacity}`}
              note="Entered and not exited"
            />
            <AdminMetric
              label="Booking utilization"
              value={`${utilization}%`}
              note={`${bookedSeats} seats across active slots`}
            />
            <AdminMetric
              label="Unavailable equipment"
              value={equipment.filter((item) => item.status !== "Available").length}
              note="Operational attention required"
            />
            <AdminMetric
              label="Upcoming booking volume"
              value={activeBookings.length}
              note={`${visits.filter((visit) => visit.status === "Active").length} active visits`}
            />
          </div>
          <div className="card-surface mt-3 p-4">
            <p className="text-sm font-semibold">Pending operational issues</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {equipment.filter((item) => item.status !== "Available").length} equipment alerts ·{" "}
              {reservations.filter((item) => item.status === "No Show").length} no-shows ·{" "}
              {reservations.filter((item) => item.status === "Cancelled").length} cancellations
            </p>
          </div>
        </section>
      )}

      {view === "config" && (
        <section id="admin-configuration" className="card-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Lab operational settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These settings define booking availability and are recorded in the prototype audit
                log.
              </p>
            </div>
            {saved && (
              <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success">
                Saved
              </span>
            )}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Lab name">
              <input
                value={draft.labName}
                onChange={(event) => updateDraft("labName", event.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Opening time">
              <input
                type="time"
                value={draft.openingTime}
                onChange={(event) => updateDraft("openingTime", event.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Closing time">
              <input
                type="time"
                value={draft.closingTime}
                onChange={(event) => updateDraft("closingTime", event.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Default slot duration (minutes)">
              <input
                type="number"
                min="15"
                value={draft.slotDuration}
                onChange={(event) => updateDraft("slotDuration", Number(event.target.value))}
                className="form-input"
              />
            </Field>
            <Field label="Capacity per slot">
              <input
                type="number"
                min="1"
                value={draft.capacity}
                onChange={(event) => updateDraft("capacity", Number(event.target.value))}
                className="form-input"
              />
            </Field>
            <Field label="Booking horizon (days)">
              <input
                type="number"
                min="1"
                value={draft.bookingHorizon}
                onChange={(event) => updateDraft("bookingHorizon", Number(event.target.value))}
                className="form-input"
              />
            </Field>
            <Field label="Cancellation window (hours)">
              <input
                type="number"
                min="0"
                value={draft.cancellationWindow}
                onChange={(event) => updateDraft("cancellationWindow", Number(event.target.value))}
                className="form-input"
              />
            </Field>
            <Field label="Maximum future bookings per project">
              <input
                type="number"
                min="1"
                value={draft.maximumFutureBookingsPerProject ?? 1}
                onChange={(event) =>
                  updateDraft("maximumFutureBookingsPerProject", Number(event.target.value))
                }
                className="form-input"
              />
            </Field>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Available days</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      updateDraft(
                        "availableDays",
                        draft.availableDays.includes(day)
                          ? draft.availableDays.filter((item) => item !== day)
                          : [...draft.availableDays, day],
                      )
                    }
                    className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${draft.availableDays.includes(day) ? "border-primary bg-primary/10 text-primary" : ""}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Closure dates</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  value={closureInput}
                  onChange={(event) => setClosureInput(event.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (closureInput && !draft.closureDates.includes(closureInput))
                      updateDraft("closureDates", [...draft.closureDates, closureInput]);
                    setClosureInput("");
                  }}
                  className="min-h-11 rounded-xl border px-3 text-sm font-semibold"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.closureDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() =>
                      updateDraft(
                        "closureDates",
                        draft.closureDates.filter((item) => item !== date),
                      )
                    }
                    className="rounded-full border px-3 py-1 text-xs"
                  >
                    {date} ×
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Quick-visit rules">
              <textarea
                value={draft.quickVisitRules}
                onChange={(event) => updateDraft("quickVisitRules", event.target.value)}
                className="form-input min-h-24 py-3"
              />
            </Field>
            <Field label="Project verification requirements">
              <textarea
                value={draft.projectVerificationRequirements}
                onChange={(event) =>
                  updateDraft("projectVerificationRequirements", event.target.value)
                }
                className="form-input min-h-24 py-3"
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={saveSettings}
            className="mt-5 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Save operational settings
          </button>
          <div className="mt-6 border-t pt-5">
            <h3 className="font-semibold">Configuration history</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Recorded changes to MakerSpace operating rules.
            </p>
            <div className="mt-3 space-y-2">
              {auditLogs.filter((event) => event.entityType === "Lab Configuration").length ? (
                auditLogs
                  .filter((event) => event.entityType === "Lab Configuration")
                  .map((event) => (
                    <div key={event.id} className="rounded-xl border p-3 text-sm">
                      <strong>{event.action}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {event.actorName} · {event.timestamp}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configuration changes made during this session will appear here.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {(view === "equipment" || view === "consumables") && (
        <section id="admin-resources">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {catalogue === "equipment" ? "Equipment catalogue" : "Consumables catalogue"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {catalogue === "equipment"
                  ? "Manage equipment details, quantities, visibility and operational attributes."
                  : "Manage consumable details, categories and active status."}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                catalogue === "equipment"
                  ? setEquipmentModal({ item: emptyEquipment() })
                  : setConsumableModal({ item: emptyConsumable() })
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <PackagePlus className="size-4" />
              Add {catalogue === "equipment" ? "equipment" : "consumable"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${catalogue}`}
                className="form-input pl-10"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="form-input sm:w-52"
            >
              <option>All</option>
              {equipmentCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="card-surface mt-4 p-4">
            <p className="text-sm font-semibold">Configured categories</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {equipmentCategories.map((item) => (
                <span key={item} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                placeholder="New configured category"
                className="form-input"
              />
              <button
                type="button"
                onClick={() => {
                  addEquipmentCategory(categoryInput);
                  setCategoryInput("");
                }}
                disabled={!categoryInput.trim()}
                className="min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
              >
                Add category
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {catalogue === "equipment"
              ? shownEquipment.map((item) => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    onEdit={() => setEquipmentModal({ id: item.id, item: { ...item } })}
                    onDelete={() =>
                      setDeleteTarget({ type: "equipment", id: item.id, name: item.name })
                    }
                  />
                ))
              : shownConsumables.map((item) => (
                  <ConsumableCard
                    key={item.id}
                    item={item}
                    onEdit={() => setConsumableModal({ id: item.id, item: { ...item } })}
                    onDelete={() =>
                      setDeleteTarget({ type: "consumable", id: item.id, name: item.name })
                    }
                  />
                ))}
          </div>
          {((catalogue === "equipment" && !shownEquipment.length) ||
            (catalogue === "consumables" && !shownConsumables.length)) && (
            <div className="card-surface mt-4 p-7 text-center text-sm text-muted-foreground">
              No {catalogue} match the current search and category filter.
            </div>
          )}
        </section>
      )}

      <ResponsiveModal
        open={!!equipmentModal}
        onOpenChange={(open) => !open && setEquipmentModal(null)}
        title={equipmentModal?.id ? "Edit equipment" : "Add equipment"}
        description="Set operational availability and student/booking visibility."
      >
        {equipmentModal && (
          <EquipmentForm
            item={equipmentModal.item}
            onChange={(item) => setEquipmentModal({ ...equipmentModal, item })}
            onSave={saveEquipment}
            categories={equipmentCategories}
          />
        )}
      </ResponsiveModal>
      <ResponsiveModal
        open={!!consumableModal}
        onOpenChange={(open) => !open && setConsumableModal(null)}
        title={consumableModal?.id ? "Edit consumable" : "Add consumable"}
        description="Consumables are configured separately from bookable equipment."
      >
        {consumableModal && (
          <ConsumableForm
            item={consumableModal.item}
            onChange={(item) => setConsumableModal({ ...consumableModal, item })}
            onSave={saveConsumable}
            categories={equipmentCategories}
          />
        )}
      </ResponsiveModal>
      <ResponsiveModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.type ?? "resource"}`}
        description="This removes the resource from the simulated catalogue."
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm">
              Remove <strong>{deleteTarget.name}</strong>? Existing booking history remains
              recorded.
            </p>
            <button
              type="button"
              onClick={confirmDelete}
              className="min-h-12 w-full rounded-xl bg-destructive font-semibold text-destructive-foreground"
            >
              Remove from catalogue
            </button>
          </div>
        )}
      </ResponsiveModal>

      {view === "dashboard" && (
        <section id="admin-oversight" className="mt-7">
          <h2 className="font-semibold">Operational oversight</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <OversightList
              title="Projects"
              items={projects.slice(0, 4).map((item) => `${item.name} · ${item.status}`)}
            />
            <OversightList
              title="Bookings"
              items={reservations.slice(0, 4).map((item) => `${item.projectName} · ${item.status}`)}
            />
            <OversightList
              title="Visits"
              items={visits.slice(0, 4).map((item) => `${item.title} · ${item.status}`)}
            />
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      <span>{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
function AdminMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="card-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}
function OversightList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="card-surface p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <p
            key={`${title}-${index}-${item}`}
            className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"
          >
            {item}
          </p>
        ))}
      </div>
    </article>
  );
}
function EquipmentCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Equipment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="card-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.category} · {item.availableQuantity}/{item.totalQuantity} available
          </p>
          <div className="mt-2">
            <StatusBadge label={item.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.name}`}
            className="grid size-10 place-items-center rounded-xl border"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${item.name}`}
            className="grid size-10 place-items-center rounded-xl border border-destructive/40 text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Student: {item.visible ? "Visible" : "Hidden"} · Booking:{" "}
        {item.bookingVisible !== false ? "Allowed" : "Hidden"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.lab} · ID {item.id} · Updated {item.updatedAt}
      </p>
    </article>
  );
}
function ConsumableCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Consumable;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="card-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.category} · {item.unit}
          </p>
          <div className="mt-2">
            <StatusBadge label={item.active ? "Available" : "Unavailable"} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.name}`}
            className="grid size-10 place-items-center rounded-xl border"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${item.name}`}
            className="grid size-10 place-items-center rounded-xl border border-destructive/40 text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
    </article>
  );
}
function EquipmentForm({
  item,
  onChange,
  onSave,
  categories,
}: {
  item: Omit<Equipment, "id">;
  onChange: (item: Omit<Equipment, "id">) => void;
  onSave: () => void;
  categories: string[];
}) {
  const set = <K extends keyof Omit<Equipment, "id">>(key: K, value: Omit<Equipment, "id">[K]) =>
    onChange({ ...item, [key]: value });
  return (
    <div className="space-y-3">
      <Field label="Equipment name">
        <input
          value={item.name}
          onChange={(event) => set("name", event.target.value)}
          className="form-input"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <select
            value={item.category}
            onChange={(event) => set("category", event.target.value as EquipmentCategory)}
            className="form-input"
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Operational status">
          <select
            value={item.status}
            onChange={(event) => set("status", event.target.value as EquipmentStatus)}
            className="form-input"
          >
            {equipmentStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Total quantity">
          <input
            type="number"
            min="1"
            value={item.totalQuantity}
            onChange={(event) => set("totalQuantity", Number(event.target.value))}
            className="form-input"
          />
        </Field>
        <Field label="Available quantity">
          <input
            type="number"
            min="0"
            max={item.totalQuantity}
            value={item.availableQuantity}
            onChange={(event) => set("availableQuantity", Number(event.target.value))}
            className="form-input"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lab / zone">
          <input
            value={item.lab}
            onChange={(event) => set("lab", event.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Image reference">
          <input
            value={item.image}
            onChange={(event) => set("image", event.target.value)}
            placeholder="Asset path or image URL"
            className="form-input"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={item.description}
          onChange={(event) => set("description", event.target.value)}
          className="form-input min-h-20 py-3"
        />
      </Field>
      <Field label="Operational notes">
        <textarea
          value={item.notes ?? ""}
          onChange={(event) => set("notes", event.target.value)}
          className="form-input min-h-20 py-3"
        />
      </Field>
      <div className="flex gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.visible}
            onChange={(event) => set("visible", event.target.checked)}
          />
          Visible to students
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.bookingVisible !== false}
            onChange={(event) => set("bookingVisible", event.target.checked)}
          />
          Available in booking
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Created {item.createdAt} · Updated {item.updatedAt}
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={!item.name.trim()}
        className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
      >
        Save equipment
      </button>
    </div>
  );
}
function ConsumableForm({
  item,
  onChange,
  onSave,
  categories,
}: {
  item: Omit<Consumable, "id">;
  onChange: (item: Omit<Consumable, "id">) => void;
  onSave: () => void;
  categories: string[];
}) {
  const set = <K extends keyof Omit<Consumable, "id">>(key: K, value: Omit<Consumable, "id">[K]) =>
    onChange({ ...item, [key]: value });
  return (
    <div className="space-y-3">
      <Field label="Consumable name">
        <input
          value={item.name}
          onChange={(event) => set("name", event.target.value)}
          className="form-input"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <select
            value={item.category}
            onChange={(event) => set("category", event.target.value)}
            className="form-input"
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Issue unit">
          <input
            value={item.unit}
            onChange={(event) => set("unit", event.target.value)}
            className="form-input"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={item.description}
          onChange={(event) => set("description", event.target.value)}
          className="form-input min-h-24 py-3"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.active}
          onChange={(event) => set("active", event.target.checked)}
        />
        Active and requestable
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={!item.name.trim()}
        className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
      >
        Save consumable
      </button>
    </div>
  );
}
