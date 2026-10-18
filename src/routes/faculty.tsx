import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, FolderKanban, ShieldCheck, Undo2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useAppSession } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { PersistedProjectDetail } from "@/components/Projects/PersistedProjectDetail";
import {
  projectStatusLabel,
  usePersistedProject,
  usePersistedProjects,
} from "@/lib/project-queries";
import { bookingsApi, readableError, type ProjectSummary } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty — सृजन" },
      { name: "description", content: "Review, verify and follow your mentees' MakerSpace work." },
    ],
  }),
  component: FacultyPage,
});

const workspaces = [
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "sessions", label: "Sessions", icon: CalendarClock },
] as const;

type WorkspaceId = (typeof workspaces)[number]["id"];

function FacultyPage() {
  const { profile } = useAppSession();
  const [workspace, setWorkspace] = useState<WorkspaceId>("projects");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const projects = usePersistedProjects();
  const rows = projects.data ?? [];
  const pending = rows.filter(
    (project) => project.mentorRequestStatus === "PENDING" && project.status !== "ARCHIVED",
  );
  const active = rows.filter((project) => project.status === "VERIFIED");
  const historical = rows.filter((project) => ["REJECTED", "ARCHIVED"].includes(project.status));
  const selected = rows.find((project) => project.id === selectedId);
  const students = new Set(rows.map((project) => project.leader.id)).size;
  return (
    <AppShell
      title={`Hi, ${profile.fullName.replace(/^(Dr\.|Prof\.)\s*/i, "").split(" ")[0] || "Mentor"}`}
      subtitle="Faculty Mentor workspace"
      workspaceNavigation={workspaces}
      activeWorkspace={workspace}
      onWorkspaceChange={(id) => setWorkspace(id as WorkspaceId)}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-3xl duration-500">
        <section
          aria-label="Mentorship at a glance"
          className="card-surface flex items-stretch divide-x divide-border px-2 py-4"
        >
          {[
            { label: "Projects", value: rows.length },
            { label: "Awaiting review", value: pending.length },
            { label: "Students", value: students },
            { label: "Verified", value: active.length },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 px-2 text-center sm:px-5">
              <p className="font-serif text-2xl font-light sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </section>
        {workspace === "projects" ? (
          <div className="mt-8 space-y-8">
            <PersistedFacultyGroup
              label="Pending approval"
              projects={pending}
              empty="You're all caught up. No projects are currently waiting for your approval."
              onOpen={setSelectedId}
            />
            <PersistedFacultyGroup
              label="Active projects"
              projects={active}
              empty="Verified projects will appear here."
              onOpen={setSelectedId}
            />
            <PersistedFacultyGroup
              label="Historical projects"
              projects={historical}
              empty="Rejected and archived projects will appear here."
              onOpen={setSelectedId}
            />
          </div>
        ) : (
          <div className="mt-8">
            <MentoredSessions />
          </div>
        )}
      </div>
      <ResponsiveModal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.title ?? "Project"}
        description="Review the team, Faculty Mentor request, and expected requirements."
        size="wide"
      >
        {selected && <PersistedFacultyProjectDetail projectId={selected.id} />}
      </ResponsiveModal>
    </AppShell>
  );
}

/**
 * Sessions booked by the projects this mentor supervises, newest day first.
 *
 * A mentor is neither the booker nor an attendee, so the server scopes these by
 * the project's current mentor. Losing a project means losing its sessions from
 * this view at the same moment.
 */
function MentoredSessions() {
  const sessions = useQuery({
    queryKey: ["mentored-sessions"],
    queryFn: () => bookingsApi.list({ scope: "all", limit: "100" }).then((r) => r.data),
    staleTime: 30_000,
  });

  if (sessions.isPending) {
    return <div className="card-surface h-48 animate-pulse bg-muted/40" aria-busy="true" />;
  }
  if (sessions.isError) {
    return (
      <div className="card-surface px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">
          {readableError(sessions.error, "Sessions could not be loaded.")}
        </p>
        <button
          type="button"
          onClick={() => void sessions.refetch()}
          className="pressable mt-5 min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
        >
          Try again
        </button>
      </div>
    );
  }

  const rows = sessions.data ?? [];
  if (!rows.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        When your students book and visit the lab, their sessions appear here day by day.
      </div>
    );
  }

  // Grouped by calendar day. A day with a session in progress floats to the top,
  // because that is the one a mentor might act on; the rest run newest first.
  const groups = new Map<string, typeof rows>();
  for (const booking of rows) {
    const key = longDate(booking.startsAt, booking.timeZone);
    groups.set(key, [...(groups.get(key) ?? []), booking]);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    const liveA = a[1].some((booking) => booking.status === "ACTIVE");
    const liveB = b[1].some((booking) => booking.status === "ACTIVE");
    if (liveA !== liveB) return liveA ? -1 : 1;
    return new Date(b[1][0]!.startsAt).getTime() - new Date(a[1][0]!.startsAt).getTime();
  });

  return (
    <div className="space-y-8">
      {ordered.map(([date, dateSessions]) => (
        <section key={date}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-serif text-xl font-light tracking-wide">{date}</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {dateSessions.length} {dateSessions.length === 1 ? "session" : "sessions"}
            </span>
          </div>
          <ol className="relative ml-2 space-y-3 border-l border-border pl-6">
            {dateSessions.map((booking) => (
              <li key={booking.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.83rem] top-6 size-3 rounded-full border-2 border-background",
                    booking.status === "ACTIVE"
                      ? "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_15%,transparent)]"
                      : booking.status === "COMPLETED"
                        ? "bg-primary/60"
                        : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <article className="card-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {clock(booking.startsAt, booking.timeZone)} –{" "}
                        {clock(booking.endsAt, booking.timeZone)}
                      </p>
                      <h3 className="mt-1 font-serif text-base font-light tracking-wide sm:text-lg">
                        {booking.projectTitle}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {booking.attendeeCount}{" "}
                        {booking.attendeeCount === 1 ? "attendee" : "attendees"}
                        {booking.equipment.length > 0 &&
                          ` · ${booking.equipment.map((item) => item.name).join(", ")}`}
                      </p>
                    </div>
                    <StatusBadge label={booking.statusLabel} className="shrink-0" />
                  </div>
                  {booking.participants.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                      {booking.participants.map((participant) => (
                        <span
                          key={participant.userId}
                          className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">{participant.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function clock(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function longDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}

function PersistedFacultyProjectDetail({ projectId }: { projectId: string }) {
  const detail = usePersistedProject(projectId);
  if (detail.isLoading)
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading review…</p>;
  if (!detail.data)
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Project review could not be loaded.
      </p>
    );
  return <PersistedProjectDetail project={detail.data} />;
}

function PersistedFacultyGroup({
  label,
  projects,
  empty,
  onOpen,
}: {
  label: string;
  projects: ProjectSummary[];
  empty: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary">{label}</p>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </div>
      {projects.length ? (
        <div className="card-surface divide-y divide-border overflow-hidden">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpen(project.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/60 sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-serif text-lg font-light">{project.title}</h2>
                  <StatusBadge label={projectStatusLabel(project.status)} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {project.description}
                </p>
                <p className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {project.leader.name} · {project.memberCount}{" "}
                  {project.memberCount === 1 ? "member" : "members"}
                </p>
              </div>
              <span className="text-xs font-semibold text-primary">Review</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card-surface px-6 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </section>
  );
}

/* ── Project groups ───────────────────────────────────────────── */

/* ── Sessions: date-wise timeline of lab activity ─────────────── */
