import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TeamMembers } from "@/components/CreateProject/TeamMembers";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import { mentorLabel } from "@/lib/mentor";
import { ResourceSelection } from "@/components/CreateProject/ResourceSelection";
import {
  emptyKit,
  formatConsumable,
  kitFromProject,
  type ResourceKit,
} from "@/lib/project-resources";
import { cn } from "@/lib/utils";
import { PersistedProjectWizard } from "@/components/CreateProject/PersistedProjectWizard";
import { ApiError, projectsApi, type FacultyDirectoryResult, type ProjectSummary } from "@/lib/api";
import { useAppSession } from "@/lib/auth-context";
import {
  invalidateProjectData,
  projectStatusLabel,
  usePersistedProjects,
} from "@/lib/project-queries";

export const Route = createFileRoute("/projects")({
  validateSearch: (search: Record<string, unknown>): { create?: boolean } =>
    search["create"] === true || search["create"] === "true" ? { create: true } : {},
  head: () => ({
    meta: [
      { title: "Projects — सृजन" },
      {
        name: "description",
        content: "Create projects, invite your team and submit for mentor verification.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/projects") return <Outlet />;
  return <PersistedProjectsPage />;
}

function PersistedProjectsPage() {
  const queryClient = useQueryClient();
  const { create } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    if (create) {
      setOpen(true);
      navigate({ search: {}, replace: true });
    }
  }, [create, navigate]);
  const projects = usePersistedProjects(
    debouncedSearch.length >= 2 ? { search: debouncedSearch } : undefined,
  );
  const invitationMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "ACCEPTED" | "DECLINED" }) =>
      projectsApi.respondToInvitation(id, decision),
    onSuccess: async (_response, variables) => {
      await invalidateProjectData(queryClient, variables.id);
      toast.success(
        variables.decision === "ACCEPTED" ? "You joined the project team" : "Invitation declined",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not respond to the invitation",
      ),
  });
  const rows = projects.data ?? [];
  const invitations = rows.filter(
    (project) =>
      project.viewerRelationship === "MEMBER" && project.viewerMemberStatus === "PENDING",
  );

  return (
    <AppShell
      title="Projects"
      subtitle={`${rows.length} ${rows.length === 1 ? "project" : "projects"}`}
    >
      <div className="mx-auto max-w-3xl">
        {invitations.length > 0 && (
          <section className="mb-6" aria-label="Pending team invitations">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
              Pending invitations
            </p>
            <div className="card-surface divide-y divide-border overflow-hidden border-primary/25">
              {invitations.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-lg font-light tracking-wide">
                      {project.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.leader.name} invited you to join this project.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={invitationMutation.isPending}
                      onClick={() =>
                        invitationMutation.mutate({ id: project.id, decision: "ACCEPTED" })
                      }
                      className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={invitationMutation.isPending}
                      onClick={() =>
                        invitationMutation.mutate({ id: project.id, decision: "DECLINED" })
                      }
                      className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            aria-label="Search projects"
            placeholder="Search your projects"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-sm"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New project
          </button>
        </div>

        {projects.isLoading ? (
          <div className="card-surface mt-5 px-6 py-14 text-center text-sm text-muted-foreground">
            Loading your projects…
          </div>
        ) : projects.isError ? (
          <div className="card-surface mt-5 px-6 py-14 text-center">
            <p className="text-sm text-destructive">Projects could not be loaded.</p>
            <button
              type="button"
              onClick={() => void projects.refetch()}
              className="mt-4 text-sm font-semibold text-primary"
            >
              Retry
            </button>
          </div>
        ) : rows.length ? (
          <div className="card-surface mt-5 divide-y divide-border overflow-hidden">
            {rows.map((project) => (
              <PersistedProjectRow key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <section className="card-surface mt-5 px-6 py-14 text-center sm:py-20">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              Chapter 01
            </p>
            <h2 className="mt-3 font-serif text-2xl font-light tracking-wide sm:text-3xl">
              Start building something
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Create a project, invite your team, and choose a Faculty Mentor before reserving
              MakerSpace time.
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="pressable mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Create project
            </button>
          </section>
        )}
      </div>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Create a project"
        description="Project details, team, Faculty Mentor, and expected requirements are submitted together."
        size="wide"
      >
        <PersistedProjectWizard
          onCreated={async (project) => {
            await invalidateProjectData(queryClient, project.id);
            setOpen(false);
            void navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
          }}
        />
      </ResponsiveModal>
    </AppShell>
  );
}

function PersistedProjectRow({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/60 sm:px-6 sm:py-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="min-w-0 truncate font-serif text-lg font-light tracking-wide sm:text-xl">
            {project.title}
          </h2>
          <StatusBadge label={projectStatusLabel(project.status)} />
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{project.description}</p>
        <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {project.viewerRelationship === "LEADER" ? "You lead" : `Lead · ${project.leader.name}`} ·{" "}
          {project.memberCount} {project.memberCount === 1 ? "member" : "members"} ·{" "}
          {project.mentor?.name ?? "Mentor pending"}
        </p>
        <p className="mt-1 text-xs font-medium text-primary">{project.statusMessage}</p>
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

const stepLabels = ["The idea", "The team", "The kit"];
