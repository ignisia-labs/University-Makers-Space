import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ApiError,
  adminApi,
  referenceApi,
  type AuditEntryDto,
  type DashboardDto,
  type ExportKind,
  type ReferenceDepartment,
  type ReferenceProgramme,
} from "@/lib/api";
import { useAppSession } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { AdminError, AdminSkeleton } from "./AdminPrimitives";
import { ReferencePanel } from "./ReferencePanel";
import { FacultyPanel } from "./FacultyPanel";
import { GovernancePanel } from "./GovernancePanel";
import { OversightPanel } from "./OversightPanel";
import { LabConfigurationPanel } from "./LabConfigurationPanel";
import { DomainManager } from "@/components/Equipment/DomainManager";
import { EquipmentManager } from "@/components/Equipment/EquipmentManager";
import { ConsumableManager } from "@/components/Equipment/ConsumableManager";

/**
 * Every tab declares the permission it needs. Tabs the operator cannot use are
 * never rendered — the server still enforces each call, but a Lab Assistant
 * should not be shown an Audit tab that would only ever return 403.
 */
const tabs = [
  { id: "dashboard", label: "Dashboard", permission: "dashboard.read" },
  { id: "oversight", label: "Oversight", permission: "visit.read.operational" },
  { id: "domains", label: "Domains", permission: "equipment.manage" },
  { id: "equipment", label: "Equipment", permission: "equipment.manage" },
  { id: "consumables", label: "Consumables", permission: "consumable.manage" },
  { id: "reference", label: "Reference data", permission: "reference_data.manage" },
  { id: "faculty", label: "Faculty", permission: "faculty.manage" },
  { id: "people", label: "People", permission: "user.roles.manage" },
  { id: "audit", label: "Audit log", permission: "audit.read" },
  { id: "reports", label: "Reports", permission: "report.export" },
  { id: "policy", label: "MakerSpace policy", permission: "lab.configure" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminConsole() {
  const { permissions } = useAppSession();
  const visibleTabs = tabs.filter((entry) => permissions.includes(entry.permission));
  const [tab, setTab] = useState<TabId>("dashboard");
  const [labId, setLabId] = useState<string | null>(null);
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await referenceApi.labs();
        if (cancelled) return;
        if (!data[0]) {
          setBootError("No MakerSpace is configured yet.");
          return;
        }
        setLabId(data[0].id);
      } catch (cause) {
        if (!cancelled) {
          setBootError(
            cause instanceof ApiError ? cause.message : "Administration is unavailable.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A role change mid-session can remove the current tab; fall back rather than
  // rendering a panel whose every call would be refused.
  const active: TabId = visibleTabs.some((entry) => entry.id === tab)
    ? tab
    : (visibleTabs[0]?.id ?? "dashboard");

  if (!visibleTabs.length) {
    return <AdminError message="Your account has no administration permissions." />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav
        className="flex flex-wrap gap-1 rounded-full border border-border p-1"
        aria-label="Administration sections"
      >
        {visibleTabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={active === entry.id ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition",
              active === entry.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {bootError ? (
        <AdminError message={bootError} />
      ) : active === "dashboard" ? (
        <DashboardPanel labId={labId} />
      ) : active === "oversight" ? (
        <OversightPanel labId={labId} />
      ) : active === "domains" ? (
        <DomainManager labId={labId} />
      ) : active === "equipment" ? (
        <EquipmentManager labId={labId} />
      ) : active === "consumables" ? (
        <ConsumableManager labId={labId} />
      ) : active === "reference" ? (
        <ReferencePanel />
      ) : active === "faculty" ? (
        <FacultyPanel />
      ) : active === "people" ? (
        <GovernancePanel />
      ) : active === "audit" ? (
        <AuditPanel />
      ) : active === "policy" ? (
        <LabConfigurationPanel />
      ) : (
        <ReportsPanel labId={labId} />
      )}
    </div>
  );
}

// ─── dashboard ───────────────────────────────────────────────────────────────

function DashboardPanel({ labId }: { labId: string | null }) {
  const [data, setData] = useState<DashboardDto | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!labId) return;
    try {
      const { data: dashboard } = await adminApi.dashboard(labId);
      setData(dashboard);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The dashboard could not be loaded.");
      setState("error");
    }
  }, [labId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!labId || state === "loading") return <AdminSkeleton />;
  if (state === "error") return <AdminError message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const noShow = data.lastSevenDays.noShowRate;
  return (
    <div className="space-y-5">
      <section className="card-surface grid grid-cols-2 divide-x divide-border py-4 sm:grid-cols-4">
        <Stat label="Inside now" value={`${data.live.occupancy}`} />
        <Stat label="Slots today" value={`${data.live.slotsToday}`} />
        <Stat label="Bookings today" value={`${data.today.bookingsTotal}`} />
        <Stat
          label="No-show rate (7d)"
          value={noShow === null ? "—" : `${Math.round(noShow * 100)}%`}
        />
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Breakdown title="Bookings today" data={data.today.bookings} />
        <Breakdown title="Bookings · last 7 days" data={data.lastSevenDays.bookings} />
        <Breakdown title="Projects" data={data.projects} />
        <Breakdown title="Equipment" data={data.equipment} />
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {data.lab.name} · {data.date} · pending Quick Visit requests:{" "}
        {data.live.pendingQuickVisitRequests}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 text-center">
      <p className="font-serif text-2xl font-light sm:text-3xl">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section className="card-surface p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">{title}</p>
      {total ? (
        <div className="mt-4 space-y-3">
          {entries
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">{label.replaceAll("_", " ").toLowerCase()}</p>
                  <p className="font-mono text-xs text-muted-foreground">{count}</p>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing recorded yet.</p>
      )}
    </section>
  );
}

// ─── audit ───────────────────────────────────────────────────────────────────

function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntryDto[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const params: Record<string, string> = { page: String(page), limit: "25" };
      if (action) params["action"] = action;
      const response = await adminApi.auditLogs(params);
      setEntries(response.data);
      setTotalPages(response.meta?.totalPages ?? 1);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The audit log could not be loaded.");
      setState("error");
    }
  }, [page, action]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void adminApi
      .auditActions()
      .then(({ data }) => setActions(data))
      .catch(() => setActions([]));
  }, []);

  if (state === "loading") return <AdminSkeleton />;
  if (state === "error") return <AdminError message={error} onRetry={() => void load()} />;

  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Audit log · append-only
        </p>
        <select
          value={action}
          onChange={(event) => {
            setPage(1);
            setAction(event.target.value);
          }}
          aria-label="Filter by action"
          className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
        >
          <option value="">All actions</option>
          {actions.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>

      {entries.length ? (
        <ol className="mt-4 divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">{entry.actor?.name ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">{entry.action}</span>
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}
                {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No audit entries match this filter.</p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Previous
        </button>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Page {page} of {Math.max(1, totalPages)}
        </p>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => current + 1)}
          className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}

// ─── reports ─────────────────────────────────────────────────────────────────

const reportKinds: Array<{ kind: ExportKind; label: string; description: string }> = [
  { kind: "bookings", label: "Bookings", description: "Every booking with status and outcome." },
  {
    kind: "visits",
    label: "Attendance",
    description: "Check-ins, check-outs, lateness, overstays.",
  },
  {
    kind: "quick-visits",
    label: "Quick Visits",
    description: "Walk-in requests and their decisions.",
  },
  { kind: "projects", label: "Projects", description: "Projects with verification status." },
  { kind: "audit-logs", label: "Audit log", description: "The full append-only trail." },
];

function ReportsPanel({ labId }: { labId: string | null }) {
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const download = async (kind: ExportKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      await adminApi.downloadExport(kind, labId ? { labId } : undefined);
      toast.success("Report downloaded");
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "The report could not be generated.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card-surface p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">CSV reports</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Streamed and capped at 100,000 rows. Every export is recorded in the audit log.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {reportKinds.map((report) => (
          <li key={report.kind} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm">{report.label}</p>
              <p className="truncate text-xs text-muted-foreground">{report.description}</p>
            </div>
            <button
              type="button"
              onClick={() => void download(report.kind)}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {busy === report.kind ? "Preparing…" : "Download"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
