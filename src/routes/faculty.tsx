import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, FolderKanban, History, LoaderCircle, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requireRoles } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";
import { useMakerSpace } from "@/lib/makerspace-context";
import { projectStatusLabel, type ProjectDetail, type ProjectSummary } from "@/lib/project-types";

export const Route = createFileRoute("/faculty")({
  beforeLoad: requireRoles("FACULTY_MENTOR"),
  validateSearch: z.object({ project: z.string().uuid().optional() }),
  component: Faculty,
});

function Faculty() {
  const { user } = useAuth();
  if (!user?.roles.includes("FACULTY_MENTOR")) return <FacultyPreview />;
  return <ConnectedFaculty />;
}

function ConnectedFaculty() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const { project: linkedProjectId } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(linkedProjectId ?? null);
  const [reason, setReason] = useState("");
  const projects = useQuery({
    queryKey: ["projects", "faculty"],
    queryFn: () => client.api.requestPage<ProjectSummary[]>("/projects?limit=50&order=desc"),
  });
  const selected = useQuery({
    queryKey: ["project", selectedId],
    queryFn: () => client.api.request<ProjectDetail>(`/projects/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const decision = useMutation({
    mutationFn: (choice: "APPROVED" | "REJECTED") =>
      client.api.request<ProjectDetail>(`/projects/${selectedId}/mentor-decision`, {
        method: "POST",
        body: JSON.stringify({
          decision: choice,
          ...(choice === "REJECTED" ? { reason: reason.trim() } : {}),
        }),
      }),
    onSuccess: (_, choice) => {
      toast.success(
        choice === "APPROVED" ? "Project approved." : "Feedback sent to the Team Leader.",
      );
      setSelectedId(null);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["projects", "faculty"] });
    },
  });

  const rows = projects.data?.data ?? [];
  const pending = rows.filter((project) => project.mentorRequestStatus === "PENDING");
  const active = rows.filter((project) => project.status === "VERIFIED");
  const historical = rows.filter(
    (project) =>
      project.status === "REJECTED" ||
      project.status === "ARCHIVED" ||
      project.mentorRequestStatus === "CANCELLED",
  );

  return (
    <AppShell
      title="Faculty workspace"
      subtitle={`${pending.length} project${pending.length === 1 ? "" : "s"} awaiting your review`}
    >
      {projects.isLoading && <LoadingCard label="Loading mentored projects…" />}
      {projects.isError && (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm text-destructive">Your Faculty workspace could not be loaded.</p>
          <button
            type="button"
            onClick={() => void projects.refetch()}
            className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
          >
            Retry
          </button>
        </section>
      )}
      {projects.data && (
        <Tabs defaultValue="pending">
          <TabsList className="grid h-auto min-h-12 w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="pending">Pending · {pending.length}</TabsTrigger>
            <TabsTrigger value="active">Active · {active.length}</TabsTrigger>
            <TabsTrigger value="history">History · {historical.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <ProjectList
              projects={pending}
              empty="No projects are waiting for your decision."
              actionLabel="Review project"
              onOpen={setSelectedId}
              icon={Clock3}
            />
          </TabsContent>
          <TabsContent value="active">
            <ProjectList
              projects={active}
              empty="No verified mentored projects yet."
              actionLabel="View project"
              onOpen={setSelectedId}
              icon={CheckCircle2}
            />
          </TabsContent>
          <TabsContent value="history">
            <ProjectList
              projects={historical}
              empty="No historical projects yet."
              actionLabel="View history"
              onOpen={setSelectedId}
              icon={History}
            />
          </TabsContent>
        </Tabs>
      )}

      <ResponsiveModal
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setReason("");
          }
        }}
        title={selected.data?.title ?? "Project review"}
        description="Review the complete submission before recording your decision."
      >
        {selected.isLoading && <LoadingCard label="Loading project submission…" />}
        {selected.data && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                Submitted {formatDate(selected.data.submittedAt ?? selected.data.createdAt)}
              </p>
              <StatusBadge label={projectStatusLabel[selected.data.status]} />
            </div>
            <section>
              <h3 className="text-sm font-semibold">Description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {selected.data.description}
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Team</h3>
              <ul className="mt-2 space-y-2">
                {selected.data.members
                  .filter((member) => member.status !== "CANCELLED")
                  .map((member) => (
                    <li key={member.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                      <span className="font-semibold">{member.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {member.role === "LEADER" ? "Team Leader" : member.status.toLowerCase()}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
            <ReviewResources
              title="Expected equipment"
              items={selected.data.equipment.map((item) => item.name)}
            />
            <ReviewResources
              title="Expected consumables"
              items={selected.data.consumables.map((item) => item.name)}
            />
            {selected.data.mentorRequests[0]?.status === "PENDING" && (
              <>
                <div>
                  <label htmlFor="rejection-reason" className="text-sm font-semibold">
                    Feedback when requesting changes
                  </label>
                  <Textarea
                    id="rejection-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    className="mt-2"
                    placeholder="Explain exactly what the Team Leader should revise."
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={decision.isPending}
                    onClick={() => decision.mutate("APPROVED")}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-success px-4 font-semibold text-success-foreground"
                  >
                    <CheckCircle2 className="size-4" /> Approve project
                  </button>
                  <button
                    type="button"
                    disabled={decision.isPending || reason.trim().length < 3}
                    onClick={() => decision.mutate("REJECTED")}
                    className="min-h-12 rounded-xl border border-destructive px-4 font-semibold text-destructive disabled:opacity-40"
                  >
                    Request changes
                  </button>
                </div>
              </>
            )}
            <Link
              to="/projects/$projectId"
              params={{ projectId: selected.data.id }}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
            >
              Open full project detail
            </Link>
          </div>
        )}
      </ResponsiveModal>
    </AppShell>
  );
}

function ProjectList({
  projects,
  empty,
  actionLabel,
  onOpen,
  icon: Icon,
}: {
  projects: ProjectSummary[];
  empty: string;
  actionLabel: string;
  onOpen: (id: string) => void;
  icon: typeof Clock3;
}) {
  if (!projects.length)
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {projects.map((project) => (
        <article key={project.id} className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <StatusBadge label={projectStatusLabel[project.status]} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{project.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-4" /> {project.leader.name} · {project.memberCount} members
          </p>
          <button
            type="button"
            onClick={() => onOpen(project.id)}
            className="mt-5 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {actionLabel}
          </button>
        </article>
      ))}
    </div>
  );
}

function ReviewResources({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {items.length ? items.join(", ") : "None declared"}
      </p>
    </section>
  );
}
function LoadingCard({ label }: { label: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-2xl border border-border bg-card">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" /> {label}
      </p>
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function FacultyPreview() {
  const { projects, updateProject } = useMakerSpace();
  const pending = projects.filter((project) => project.status === "Mentor Approval Pending");
  return (
    <AppShell
      title="Faculty workspace"
      subtitle="Prototype view — backend permissions remain unchanged"
    >
      <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
        This is the Phase 8 mock role preview. Sign in with a pre-provisioned Faculty Mentor account
        to test persisted approvals.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {pending.map((project) => (
          <article key={project.id} className="card-surface p-5">
            <FolderKanban className="size-5 text-primary" />
            <h2 className="mt-3 font-semibold">{project.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
            <button
              type="button"
              onClick={() => updateProject(project.id, { status: "Verified" })}
              className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Preview approval
            </button>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
