import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  bookingsApi,
  projectsApi,
  quickVisitsApi,
  visitsApi,
  type BookingDto,
  type ProjectSummary,
  type QuickVisitDto,
  type VisitDto,
} from "@/lib/api";
import { AdminError, AdminSkeleton, Pager } from "./AdminPrimitives";
import { cn } from "@/lib/utils";

const views = [
  { id: "bookings", label: "Bookings" },
  { id: "visits", label: "Attendance" },
  { id: "quick-visits", label: "Quick Visits" },
  { id: "projects", label: "Projects" },
] as const;

type ViewId = (typeof views)[number]["id"];

/**
 * Read-only oversight across the MakerSpace.
 *
 * Every list here is server-paginated and server-authorised — an operator sees
 * these records because their role carries the operational read permission, not
 * because the client asked nicely.
 */
export function OversightPanel({ labId }: { labId: string | null }) {
  const [view, setView] = useState<ViewId>("bookings");
  const [page, setPage] = useState(1);

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1" aria-label="Oversight views">
        {views.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setView(entry.id);
              setPage(1);
            }}
            aria-current={view === entry.id ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition",
              view === entry.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <OversightList view={view} labId={labId} page={page} onPage={setPage} />
    </div>
  );
}

type Row = { id: string; primary: string; secondary: string; trailing: string };

function OversightList({
  view,
  labId,
  page,
  onPage,
}: {
  view: ViewId;
  labId: string | null;
  page: number;
  onPage: (page: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState((current) => (current === "ready" ? "ready" : "loading"));
    const params: Record<string, string> = { page: String(page), limit: "20" };
    try {
      if (view === "bookings") {
        const response = await bookingsApi.list({ ...params, scope: "all" });
        setRows(response.data.map(bookingRow));
        setTotalPages(response.meta?.totalPages ?? 1);
        setTotal(response.meta?.total ?? response.data.length);
      } else if (view === "visits") {
        const response = await visitsApi.list({ ...params, ...(labId ? { labId } : {}) });
        setRows(response.data.map(visitRow));
        setTotalPages(response.meta?.totalPages ?? 1);
        setTotal(response.meta?.total ?? response.data.length);
      } else if (view === "quick-visits") {
        const response = await quickVisitsApi.list({ ...params, scope: "all" });
        setRows(response.data.map(quickVisitRow));
        setTotalPages(response.meta?.totalPages ?? 1);
        setTotal(response.meta?.total ?? response.data.length);
      } else {
        const response = await projectsApi.list(params);
        setRows(response.data.map(projectRow));
        setTotalPages(response.meta?.totalPages ?? 1);
        setTotal(response.meta?.total ?? response.data.length);
      }
      setState("ready");
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That list could not be loaded.");
      setState("error");
    }
  }, [view, labId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") return <AdminSkeleton />;
  if (state === "error") return <AdminError message={error} onRetry={() => void load()} />;

  return (
    <section className="card-surface p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
        {total} record{total === 1 ? "" : "s"}
      </p>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-sm">{row.primary}</p>
                <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {row.trailing}
                </p>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {row.secondary}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
      )}
      <Pager page={page} totalPages={totalPages} onChange={onPage} />
    </section>
  );
}

function bookingRow(booking: BookingDto): Row {
  return {
    id: booking.id,
    primary: booking.projectTitle,
    secondary: `${booking.statusLabel} · ${booking.attendeeCount} attendees · ${booking.labName}`,
    trailing: formatDateTime(booking.startsAt, booking.timeZone),
  };
}

function visitRow(visit: VisitDto): Row {
  const flags = [
    visit.isLateArrival ? `late ${visit.lateByMinutes}m` : null,
    visit.isOverstay ? `over ${visit.overstayByMinutes}m` : null,
  ].filter(Boolean);
  return {
    id: visit.id,
    primary: `${visit.visitor.name} · ${visit.projectTitle ?? "Quick Visit"}`,
    secondary: [visit.statusLabel, ...flags].join(" · "),
    trailing: formatDateTime(visit.checkedInAt, visit.timeZone),
  };
}

function quickVisitRow(quickVisit: QuickVisitDto): Row {
  return {
    id: quickVisit.id,
    primary: `${quickVisit.visitor.name} · ${quickVisit.purpose}`,
    secondary: quickVisit.statusLabel,
    trailing: formatDateTime(quickVisit.startsAt, quickVisit.timeZone),
  };
}

function projectRow(project: ProjectSummary): Row {
  return {
    id: project.id,
    primary: project.title,
    secondary: `${project.status.replaceAll("_", " ").toLowerCase()} · leader ${project.leader.name} · ${project.memberCount} members`,
    trailing: project.mentor?.name ?? "no mentor",
  };
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
