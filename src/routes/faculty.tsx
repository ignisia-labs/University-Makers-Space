import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, FolderKanban, ShieldCheck, Undo2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ProjectDetailPanel } from "@/components/Projects/ProjectDetailPanel";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import type { Project, Reservation } from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { useAppSession } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { PersistedProjectDetail } from "@/components/Projects/PersistedProjectDetail";
import {
  projectStatusLabel,
  usePersistedProject,
  usePersistedProjects,
} from "@/lib/project-queries";
import type { ProjectSummary } from "@/lib/api";

export const Route = createFileRoute("/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty — MIT-WPU MakerSpace" },
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
  const { prototype } = useAppSession();
  return prototype ? <PrototypeFacultyPage /> : <PersistedFacultyPage />;
}

function PersistedFacultyPage() {
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
          <div className="card-surface mt-8 px-6 py-14 text-center text-sm text-muted-foreground">
            Faculty booking sessions connect in Phase 4.
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

function PrototypeFacultyPage() {
  const { projects, reservations, verifyProject, updateProject } = useMakerSpace();
  const { profile } = useAppSession();
  const [workspace, setWorkspace] = useState<WorkspaceId>("projects");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A mentor only ever sees the projects assigned to them.
  const mine = projects.filter(
    (project) =>
      project.status !== "Archived" &&
      Boolean(profile.fullName) &&
      project.mentor.includes(profile.fullName),
  );
  const mineIds = new Set(mine.map((project) => project.id));
  const sessions = reservations.filter((reservation) => mineIds.has(reservation.projectId));
  const pending = mine.filter((project) => project.status !== "Verified");
  const verified = mine.filter((project) => project.status === "Verified");
  const students = new Set(
    mine.flatMap((project) => [project.leader, ...project.members.map((member) => member.name)]),
  ).size;
  const selected = mine.find((project) => project.id === selectedId);

  return (
    <AppShell
      title={`Hi, ${profile.fullName.replace(/^(Dr\.|Prof\.)\s*/i, "").split(" ")[0] || "Mentor"}`}
      subtitle="Faculty mentor workspace"
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
            { label: "Projects", value: String(mine.length) },
            { label: "Awaiting review", value: String(pending.length) },
            { label: "Students", value: String(students) },
            { label: "Sessions", value: String(sessions.length) },
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
          {workspace === "projects" ? (
            <div className="space-y-8">
              <ProjectGroup
                label="Awaiting your review"
                projects={pending}
                empty="Nothing waiting on you right now."
                onOpen={setSelectedId}
                action={(project) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      verifyProject(project.id);
                      toast.success(`${project.name} verified`);
                    }}
                    className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <ShieldCheck className="size-3.5" /> Verify
                  </button>
                )}
              />
              <ProjectGroup
                label="Verified"
                projects={verified}
                empty="Verified projects will collect here."
                onOpen={setSelectedId}
                action={(project) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateProject(project.id, { status: "Mentor Approval Pending" });
                      toast.success(`${project.name} sent back for review`);
                    }}
                    className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" /> Unverify
                  </button>
                )}
              />
            </div>
          ) : (
            <SessionsTimeline sessions={sessions} projects={mine} />
          )}
        </div>
      </div>

      <ResponsiveModal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.name ?? "Project"}
        description="Team, kit and booking history for this project."
        size="wide"
      >
        {selected && (
          <>
            <ProjectDetailPanel
              project={selected}
              profile={profile}
              reservations={reservations.filter(
                (reservation) => reservation.projectId === selected.id,
              )}
            />
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              {selected.status === "Verified" ? (
                <button
                  type="button"
                  onClick={() => {
                    updateProject(selected.id, { status: "Mentor Approval Pending" });
                    toast.success(`${selected.name} sent back for review`);
                  }}
                  className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Undo2 className="size-4" /> Unverify
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    verifyProject(selected.id);
                    toast.success(`${selected.name} verified`);
                  }}
                  className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <ShieldCheck className="size-4" /> Verify project
                </button>
              )}
            </div>
          </>
        )}
      </ResponsiveModal>
    </AppShell>
  );
}

/* ── Project groups ───────────────────────────────────────────── */

function ProjectGroup({
  label,
  projects,
  empty,
  onOpen,
  action,
}: {
  label: string;
  projects: Project[];
  empty: string;
  onOpen: (id: string) => void;
  action: (project: Project) => React.ReactNode;
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
            <article
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(project.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpen(project.id);
              }}
              className="group cursor-pointer px-5 py-4 transition-colors hover:bg-secondary/60 sm:px-6 sm:py-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="min-w-0 truncate font-serif text-lg font-light tracking-wide">
                      {project.name}
                    </h2>
                    <StatusBadge label={project.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <Users className="size-3" /> {project.leader} · {project.members.length + 1}{" "}
                    {project.members.length === 0 ? "member" : "members"}
                  </p>
                </div>
                <div className="shrink-0">{action(project)}</div>
              </div>
              {project.resources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.resources.map((resource) => (
                    <span
                      key={resource}
                      className="rounded-full border border-primary/20 bg-primary/[0.05] px-2.5 py-1 text-[11px] font-medium text-primary"
                    >
                      {resource}
                    </span>
                  ))}
                  {(project.consumables ?? []).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </article>
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

/* ── Sessions: date-wise timeline of lab activity ─────────────── */

function SessionsTimeline({
  sessions,
  projects,
}: {
  sessions: Reservation[];
  projects: Project[];
}) {
  if (!sessions.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        When your students book and visit the lab, their sessions appear here day by day.
      </div>
    );
  }

  // Group by calendar date, upcoming days first.
  const groups = new Map<string, Reservation[]>();
  sessions.forEach((session) => {
    groups.set(session.date, [...(groups.get(session.date) ?? []), session]);
  });
  const ordered = [...groups.entries()].sort((a, b) => {
    const activeA = a[1].some((s) => s.status === "Active");
    const activeB = b[1].some((s) => s.status === "Active");
    if (activeA !== activeB) return activeA ? -1 : 1;
    return dayNumber(b[0]) - dayNumber(a[0]);
  });

  const participantName = (session: Reservation, id: string) => {
    const project = projects.find((item) => item.id === session.projectId);
    if (id === "leader") return project?.leader ?? "Team leader";
    return project?.members.find((member) => member.id === id)?.name ?? "Team member";
  };

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
            {dateSessions.map((session) => {
              const attendance = session.attendance ?? {};
              const checkins = session.participantIds
                .map((id) => ({ id, record: attendance[id] }))
                .filter((entry) => entry.record?.enteredAt);
              return (
                <li key={session.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[1.83rem] top-6 size-3 rounded-full border-2 border-background",
                      session.status === "Active"
                        ? "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_15%,transparent)]"
                        : session.status === "Completed"
                          ? "bg-primary/60"
                          : "bg-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                  <article className="card-surface p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {session.slot}
                        </p>
                        <h3 className="mt-1 font-serif text-base font-light tracking-wide sm:text-lg">
                          {session.projectName}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.attendees} {session.attendees === 1 ? "attendee" : "attendees"}
                          {session.resources.length > 0 && ` · ${session.resources.join(", ")}`}
                        </p>
                      </div>
                      <StatusBadge
                        label={session.status === "Active" ? "Confirmed" : session.status}
                        className="shrink-0"
                      />
                    </div>
                    {checkins.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                        {checkins.map(({ id, record }) => (
                          <span
                            key={id}
                            className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {participantName(session, id)}
                            </span>{" "}
                            {record?.enteredAt}
                            {record?.exitedAt ? ` → ${record.exitedAt}` : " · in the lab"}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function dayNumber(date: string) {
  return Number(date.match(/\b(\d{1,2})\b/)?.[1] ?? 0);
}
