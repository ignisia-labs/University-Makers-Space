import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LoaderCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import { ResourceSelection } from "@/components/CreateProject/ResourceSelection";
import { TeamMembers } from "@/components/CreateProject/TeamMembers";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireRoles } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import {
  projectStatusLabel,
  type DirectoryUser,
  type LabReference,
  type ProjectDetail,
  type ProjectSummary,
} from "@/lib/project-types";

export const Route = createFileRoute("/projects")({
  beforeLoad: requireRoles("STUDENT"),
  head: () => ({
    meta: [
      { title: "Projects hub — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Create projects, invite team members, choose a Faculty Mentor and track verification.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const projects = useQuery({
    queryKey: ["projects", "student", term, page],
    queryFn: () =>
      client.api.requestPage<ProjectSummary[]>(
        `/projects?page=${page}&limit=12&order=desc${term ? `&search=${encodeURIComponent(term)}` : ""}`,
      ),
  });

  return (
    <AppShell
      title="Projects"
      subtitle={
        projects.data
          ? `${projects.data.meta.total} project${projects.data.meta.total === 1 ? "" : "s"} in your workspace`
          : "Your MakerSpace builds"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your projects"
            className="h-12 bg-card pl-10"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="size-5" /> Create project
        </button>
      </div>

      {projects.isLoading && (
        <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-border bg-card">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Loading projects…
          </p>
        </div>
      )}
      {projects.isError && (
        <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold text-destructive">Projects could not be loaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check the backend connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void projects.refetch()}
            className="mt-4 min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      )}
      {projects.data && projects.data.data.length === 0 && (
        <section className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <FolderKanban className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              {term ? "No projects match your search" : "Start your first MakerSpace project"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {term
                ? "Try a different project name or description."
                : "Create a solo or team project and send it to a Faculty Mentor for verification."}
            </p>
          </div>
        </section>
      )}
      {projects.data && projects.data.data.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.data.map((project) => (
            <article key={project.id} className="card-surface flex min-h-64 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="line-clamp-2 text-lg font-semibold">{project.title}</h2>
                <StatusBadge label={projectStatusLabel[project.status]} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                {project.description}
              </p>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Team Leader</dt>
                  <dd className="truncate font-semibold">{project.leader.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Faculty Mentor</dt>
                  <dd className="truncate font-semibold">
                    {project.mentor?.name ?? "Not selected"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                  <Users className="size-3.5" /> {project.memberCount} member
                  {project.memberCount === 1 ? "" : "s"}
                </span>
                {project.nextBooking && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                    <CalendarClock className="size-3.5" /> Next booking scheduled
                  </span>
                )}
              </div>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="mt-auto pt-5 text-sm font-semibold text-primary"
              >
                Open project
              </Link>
            </article>
          ))}
        </div>
      )}

      {projects.data && projects.data.meta.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Project pages">
          <button
            type="button"
            disabled={!projects.data.meta.hasPrev}
            onClick={() => setPage((value) => value - 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {projects.data.meta.page} of {projects.data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!projects.data.meta.hasNext}
            onClick={() => setPage((value) => value + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold disabled:opacity-40"
          >
            Next <ChevronRight className="size-4" />
          </button>
        </nav>
      )}

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Create a MakerSpace project"
        description="Add the team, Faculty Mentor and expected resources in one submission."
      >
        <ProjectForm
          onCreated={(project) => {
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success(`${project.title} was submitted for verification.`);
          }}
        />
      </ResponsiveModal>
    </AppShell>
  );
}

function ProjectForm({ onCreated }: { onCreated: (project: ProjectDetail) => void }) {
  const { client } = useAuth();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labId, setLabId] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [mentor, setMentor] = useState<DirectoryUser | null>(null);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [consumableIds, setConsumableIds] = useState<string[]>([]);

  const labs = useQuery({
    queryKey: ["reference-data", "labs"],
    queryFn: () => client.api.request<LabReference[]>("/reference-data/labs"),
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (!labId && labs.data?.length) setLabId(labs.data[0]!.id);
  }, [labId, labs.data]);

  const createProject = useMutation({
    mutationFn: () =>
      client.api.request<ProjectDetail>("/projects", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          labId,
          title: title.trim(),
          description: description.trim(),
          teamMemberEmails: members,
          mentorId: mentor!.id,
          equipmentIds,
          consumableIds,
        }),
      }),
    onSuccess: onCreated,
  });

  const canSubmit =
    title.trim().length >= 2 &&
    description.trim().length > 0 &&
    Boolean(labId && mentor) &&
    !createProject.isPending;

  return (
    <form
      className="min-w-0 space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) createProject.mutate();
      }}
    >
      <section className="space-y-4" aria-labelledby="project-information-heading">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Project</p>
          <h2 id="project-information-heading" className="mt-1 text-lg font-semibold">
            What are you building?
          </h2>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-name">Project name</Label>
          <Input
            id="p-name"
            required
            className="h-12"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Solar tracking panel"
            maxLength={160}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-desc">Project description</Label>
          <Textarea
            id="p-desc"
            required
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain what the team is building and the intended outcome."
            maxLength={2000}
          />
          <p className="text-right text-xs text-muted-foreground">{description.length}/2000</p>
        </div>
      </section>

      <div className="h-px bg-border" />
      <TeamMembers members={members} onChange={setMembers} />
      <div className="h-px bg-border" />
      <MentorSelect value={mentor} onValueChange={setMentor} />
      <div className="h-px bg-border" />
      {labId ? (
        <ResourceSelection
          labId={labId}
          equipmentIds={equipmentIds}
          consumableIds={consumableIds}
          onEquipmentChange={setEquipmentIds}
          onConsumableChange={setConsumableIds}
        />
      ) : (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {labs.isLoading
            ? "Loading MakerSpace configuration…"
            : "No active MakerSpace is configured."}
        </p>
      )}

      {createProject.isError && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {createProject.error instanceof ApiClientError
            ? (createProject.error.details[0]?.message ?? createProject.error.message)
            : "The project could not be submitted. Try again."}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createProject.isPending && <LoaderCircle className="size-5 animate-spin" />}
        {createProject.isPending
          ? "Submitting project…"
          : "Create project and request verification"}
      </button>
    </form>
  );
}
