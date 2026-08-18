import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CalendarClock, FolderKanban, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import type { Project, Reservation } from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

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
  { id: "equipment", label: "Equipment", icon: Boxes },
] as const;

type WorkspaceId = (typeof workspaces)[number]["id"];

function FacultyPage() {
  const { profile, projects, reservations, verifyProject, updateProject } = useMakerSpace();
  const [workspace, setWorkspace] = useState<WorkspaceId>("projects");
  const [scope, setScope] = useState<"mine" | "all">("mine");

  const isMine = (project: Project) =>
    Boolean(profile.fullName) && project.mentor.includes(profile.fullName);
  const mineCount = projects.filter(isMine).length;
  const visible = projects.filter(
    (project) => project.status !== "Archived" && (scope === "all" || isMine(project)),
  );
  const visibleIds = new Set(visible.map((project) => project.id));
  const sessions = reservations.filter((reservation) => visibleIds.has(reservation.projectId));

  return (
    <AppShell
      title={`Hi, ${profile.fullName.replace(/^(Dr\.|Prof\.)\s*/i, "").split(" ")[0] || "Mentor"}`}
      subtitle="Faculty mentor workspace"
      workspaceNavigation={workspaces}
      activeWorkspace={workspace}
      onWorkspaceChange={(id) => setWorkspace(id as WorkspaceId)}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Project scope"
            className="inline-flex rounded-full border border-border bg-card p-1"
          >
            {(
              [
                { id: "mine", label: `My mentees (${mineCount})` },
                { id: "all", label: "All projects" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={scope === item.id}
                onClick={() => setScope(item.id)}
                className={cn(
                  "min-h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-wider transition-colors",
                  scope === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {workspace === "projects" && (
            <ProjectsBoard
              projects={visible}
              onVerify={(project) => {
                verifyProject(project.id);
                toast.success(`${project.name} verified`);
              }}
              onUnverify={(project) => {
                updateProject(project.id, { status: "Mentor Approval Pending" });
                toast.success(`${project.name} sent back for review`);
              }}
            />
          )}
          {workspace === "sessions" && <SessionsBoard sessions={sessions} projects={visible} />}
          {workspace === "equipment" && <EquipmentBoard projects={visible} />}
        </div>
      </div>
    </AppShell>
  );
}

/* ── Projects: review, verify, unverify ───────────────────────── */

function ProjectsBoard({
  projects,
  onVerify,
  onUnverify,
}: {
  projects: Project[];
  onVerify: (project: Project) => void;
  onUnverify: (project: Project) => void;
}) {
  if (!projects.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        Projects that name you as mentor will appear here for review.
      </div>
    );
  }
  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {projects.map((project) => (
        <article key={project.id} className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="min-w-0 truncate font-serif text-lg font-light tracking-wide">
                  {project.name}
                </h2>
                <StatusBadge label={project.status} />
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {project.description}
              </p>
              <p className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Lead · {project.leader} · {project.members.length + 1}{" "}
                {project.members.length === 0 ? "member" : "members"} · {project.mentor}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {project.status === "Verified" ? (
                <button
                  type="button"
                  onClick={() => onUnverify(project)}
                  className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Undo2 className="size-3.5" /> Unverify
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onVerify(project)}
                  className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <ShieldCheck className="size-3.5" /> Verify
                </button>
              )}
            </div>
          </div>
          {(project.resources.length > 0 || (project.consumables?.length ?? 0) > 0) && (
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
  );
}

/* ── Sessions: when mentees were in the lab ───────────────────── */

function SessionsBoard({ sessions, projects }: { sessions: Reservation[]; projects: Project[] }) {
  if (!sessions.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        Lab sessions booked by your mentees will appear here.
      </div>
    );
  }
  const ordered = [...sessions].sort(
    (a, b) => Number(b.status === "Active") - Number(a.status === "Active"),
  );
  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {ordered.map((session) => {
        const project = projects.find((item) => item.id === session.projectId);
        const attendance = Object.values(session.attendance ?? {});
        const entered = attendance.filter((record) => record.enteredAt).length;
        return (
          <article key={session.id} className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session.projectName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {session.date} · {session.slot} · {session.attendees}{" "}
                  {session.attendees === 1 ? "attendee" : "attendees"}
                  {entered > 0 && ` · ${entered} checked in`}
                </p>
                {project && (
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Lead · {project.leader}
                  </p>
                )}
              </div>
              <StatusBadge
                label={session.status === "Active" ? "Confirmed" : session.status}
                className="shrink-0"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ── Equipment: what mentees are using ────────────────────────── */

function EquipmentBoard({ projects }: { projects: Project[] }) {
  const usage = new Map<string, string[]>();
  projects.forEach((project) => {
    project.resources.forEach((resource) => {
      usage.set(resource, [...(usage.get(resource) ?? []), project.name]);
    });
  });
  const rows = [...usage.entries()].sort((a, b) => b[1].length - a[1].length);

  if (!rows.length) {
    return (
      <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
        Equipment requested by your mentees' projects will appear here.
      </div>
    );
  }
  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {rows.map(([resource, names]) => (
        <div key={resource} className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-medium">{resource}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{names.join(" · ")}</p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/[0.05] px-2.5 py-1 text-[11px] font-mono text-primary">
            {names.length} {names.length === 1 ? "project" : "projects"}
          </span>
        </div>
      ))}
    </div>
  );
}
