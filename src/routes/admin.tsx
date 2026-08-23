import { createFileRoute } from "@tanstack/react-router";
import { useMakerSpace } from "@/lib/makerspace-context";
import { AppShell } from "@/components/AppShell";
import { LabConfigurationPanel } from "@/components/Admin/LabConfigurationPanel";
import { useAppSession } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — MIT-WPU MakerSpace" },
      { name: "description", content: "MakerSpace usage at a glance." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { prototype } = useAppSession();
  if (!prototype) {
    return (
      <AppShell title="MakerSpace policy" subtitle="Admin configuration">
        <LabConfigurationPanel />
      </AppShell>
    );
  }
  return <PrototypeAdminPage />;
}

function PrototypeAdminPage() {
  const { projects, reservations, visits, equipment, users, uploads, auditLogs } = useMakerSpace();

  const students = users.filter((user) => user.role === "Student").length;
  const activeProjects = projects.filter((project) => project.status !== "Archived");
  const completedVisits = visits.filter((visit) => visit.status === "Completed" && visit.exit);
  const labMinutes = completedVisits.reduce(
    (total, visit) => total + minutesBetween(visit.entry, visit.exit),
    0,
  );
  const unitsFree = equipment.reduce((total, item) => total + item.availableQuantity, 0);
  const unitsTotal = equipment.reduce((total, item) => total + item.totalQuantity, 0);

  const projectStatuses = countBy(activeProjects.map((project) => project.status));
  const bookingStatuses = countBy(
    reservations.map((r) => (r.status === "Active" ? "Confirmed" : r.status)),
  );

  return (
    <AppShell title="Admin" subtitle="MakerSpace at a glance">
      <div className="mx-auto max-w-3xl space-y-8">
        <section
          aria-label="Headline numbers"
          className="card-surface grid grid-cols-2 divide-x divide-border py-4 sm:grid-cols-4"
        >
          {[
            { label: "Students", value: String(students) },
            { label: "Projects", value: String(activeProjects.length) },
            { label: "Sessions", value: String(reservations.length) },
            { label: "Lab time", value: formatMinutes(labMinutes) },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-2 text-center">
              <p className="font-serif text-2xl font-light sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          <BreakdownCard title="Projects by status" data={projectStatuses} />
          <BreakdownCard title="Sessions by outcome" data={bookingStatuses} />
        </div>

        <section className="card-surface p-5 sm:p-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Equipment utilisation
          </p>
          <div className="mt-4 space-y-3">
            {equipment
              .filter((item) => item.visible)
              .map((item) => {
                const used = item.totalQuantity - item.availableQuantity;
                const percent = Math.round((used / Math.max(1, item.totalQuantity)) * 100);
                return (
                  <div key={item.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {used} of {item.totalQuantity} in use
                      </p>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          percent >= 100 ? "bg-warning" : "bg-primary",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {unitsFree} of {unitsTotal} units free · {uploads.length}{" "}
            {uploads.length === 1 ? "file" : "files"} queued
          </p>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Recent activity
          </p>
          {auditLogs.length ? (
            <ol className="mt-4 space-y-3">
              {auditLogs.slice(0, 8).map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-medium">{event.actorName}</span>{" "}
                    <span className="text-muted-foreground">
                      {event.action.toLowerCase()} · {event.entity}
                    </span>
                  </p>
                  <p className="shrink-0 text-[10px] font-mono text-muted-foreground">
                    {event.timestamp}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Actions across the MakerSpace will appear here.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Map<string, number> }) {
  const total = [...data.values()].reduce((sum, count) => sum + count, 0);
  return (
    <section className="card-surface p-5 sm:p-6">
      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">{title}</p>
      {total ? (
        <div className="mt-4 space-y-3">
          {[...data.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">{label}</p>
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
        <p className="mt-3 text-sm text-muted-foreground">No data yet.</p>
      )}
    </section>
  );
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return map;
}

function minutesBetween(entry: string, exit: string | null) {
  if (!exit) return 0;
  const [entryHour = 0, entryMinute = 0] = entry.split(":").map(Number);
  const [exitHour = 0, exitMinute = 0] = exit.split(":").map(Number);
  return Math.max(0, exitHour * 60 + exitMinute - (entryHour * 60 + entryMinute));
}

function formatMinutes(total: number) {
  if (!total) return "0h";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
