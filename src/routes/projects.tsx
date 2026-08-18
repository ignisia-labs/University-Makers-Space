import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ProjectDetailPanel } from "@/components/Projects/ProjectDetailPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Project } from "@/lib/makerspace-data";
import { TeamMembers } from "@/components/CreateProject/TeamMembers";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import { ResourceSelection } from "@/components/CreateProject/ResourceSelection";
import {
  emptyKit,
  formatConsumable,
  kitFromProject,
  type ResourceKit,
} from "@/lib/project-resources";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects")({
  validateSearch: (search: Record<string, unknown>): { create?: boolean } =>
    search["create"] === true || search["create"] === "true" ? { create: true } : {},
  head: () => ({
    meta: [
      { title: "Projects — MIT-WPU MakerSpace" },
      {
        name: "description",
        content: "Create projects, invite your team and submit for mentor verification.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const {
    projects,
    profile,
    reservations,
    addProject,
    updateProject,
    deleteProject,
    verifyProject,
    acceptProjectInvitation,
  } = useMakerSpace();
  const { create } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const isLeaderOf = (project: Project) =>
    Boolean(profile.fullName) && project.leader.toLowerCase() === profile.fullName.toLowerCase();
  const visibleProjects = projects.filter(
    (project) =>
      isLeaderOf(project) ||
      project.members.some((member) => member.email?.toLowerCase() === profile.email.toLowerCase()),
  );
  const invitations = projects.filter((project) =>
    project.invitedEmails.some((invited) => invited.toLowerCase() === profile.email.toLowerCase()),
  );

  useEffect(() => {
    if (create) {
      setOpen(true);
      navigate({ search: {}, replace: true });
    }
  }, [create, navigate]);

  return (
    <AppShell
      title="Projects"
      subtitle={`${visibleProjects.length} ${visibleProjects.length === 1 ? "project" : "projects"}`}
    >
      <div className="mx-auto max-w-3xl">
        {invitations.length > 0 && (
          <section className="mb-6" aria-label="Invitations">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
              Invitations
            </p>
            <div className="card-surface divide-y divide-border overflow-hidden border-primary/25">
              {invitations.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-lg font-light tracking-wide">
                      {project.name}
                    </h2>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                    <p className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Invited by {project.leader} · {project.mentor}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      acceptProjectInvitation(project.id, profile);
                      toast.success(`You joined ${project.name}`);
                    }}
                    className="pressable inline-flex min-h-11 shrink-0 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Join project
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {visibleProjects.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="pressable inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> New project
            </button>
          </div>
        )}

        {visibleProjects.length > 0 ? (
          <div className="card-surface mt-5 divide-y divide-border overflow-hidden">
            {visibleProjects.map((project) => {
              const isLeader = isLeaderOf(project);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/60 sm:px-6 sm:py-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="min-w-0 truncate font-serif text-lg font-light tracking-wide sm:text-xl">
                        {project.name}
                      </h2>
                      <StatusBadge label={project.status} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                    <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {isLeader ? "You lead" : `Lead · ${project.leader}`} ·{" "}
                      {project.members.length + 1}{" "}
                      {project.members.length === 0 ? "member" : "members"} · {project.mentor}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              );
            })}
          </div>
        ) : (
          <section className="card-surface mt-2 px-6 py-14 text-center sm:py-20">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              Chapter 01
            </p>
            <h2 className="mt-3 font-serif text-2xl font-light tracking-wide sm:text-3xl">
              Start building something
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              A project is your key to the MakerSpace — your idea, your team, one mentor.
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
        description="Your idea, your team, your kit — then submit for verification."
        size="wide"
      >
        <ProjectWizard
          onSubmit={(data) => {
            addProject({
              ...data,
              leader: profile.fullName,
              leaderEmail: profile.email,
              members: [],
              status: data.invitedEmails.length
                ? "Team Acceptance Pending"
                : "Mentor Approval Pending",
            });
            setOpen(false);
            toast.success("Project submitted for mentor verification");
          }}
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(selectedProject)}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedProjectId(null)}
        title={selectedProject?.name ?? "Project details"}
        description="Team, mentor, resources and verification readiness."
        size="wide"
      >
        {selectedProject && (
          <ProjectDetailPanel
            project={selectedProject}
            profile={profile}
            reservations={reservations.filter(
              (reservation) => reservation.projectId === selectedProject.id,
            )}
            onSubmitForVerification={() =>
              updateProject(selectedProject.id, {
                status: selectedProject.invitedEmails.length
                  ? "Team Acceptance Pending"
                  : "Mentor Approval Pending",
              })
            }
            onVerify={() => {
              verifyProject(selectedProject.id);
              toast.success(`${selectedProject.name} verified`);
            }}
            onEdit={() => {
              setEditTarget(selectedProject);
              setSelectedProjectId(null);
            }}
            onDelete={() => {
              setDeleteTarget(selectedProject);
              setSelectedProjectId(null);
            }}
          />
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(editTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setEditTarget(null)}
        title={`Edit ${editTarget?.name ?? "project"}`}
        description="Changing the kit sends the project back for re-verification."
        size="wide"
      >
        {editTarget && (
          <ProjectWizard
            initial={{
              name: editTarget.name,
              description: editTarget.description,
              invitedEmails: editTarget.invitedEmails,
              mentor: editTarget.mentor,
              kit: kitFromProject(editTarget.resources, editTarget.consumables ?? []),
            }}
            submitLabel="Save changes"
            onSubmit={(data) => {
              const kitChanged =
                JSON.stringify([...data.resources].sort()) !==
                  JSON.stringify([...editTarget.resources].sort()) ||
                JSON.stringify([...data.consumables].sort()) !==
                  JSON.stringify([...(editTarget.consumables ?? [])].sort());
              updateProject(editTarget.id, {
                name: data.name,
                description: data.description,
                invitedEmails: data.invitedEmails,
                mentor: data.mentor,
                resources: data.resources,
                consumables: data.consumables,
                ...(kitChanged ? { status: "Mentor Approval Pending" as const } : {}),
              });
              setEditTarget(null);
              toast.success(
                kitChanged ? "Kit changed — project sent for re-verification" : "Project updated",
              );
            }}
          />
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "project"}?`}
        description="This removes the project and releases any active bookings. This cannot be undone."
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
          >
            Keep project
          </button>
          <button
            type="button"
            onClick={() => {
              if (!deleteTarget) return;
              deleteProject(deleteTarget.id);
              setDeleteTarget(null);
              toast.success("Project deleted");
            }}
            className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground"
          >
            Delete project
          </button>
        </div>
      </ResponsiveModal>
    </AppShell>
  );
}

const stepLabels = ["The idea", "The team", "The kit"];

function ProjectWizard({
  onSubmit,
  initial,
  submitLabel = "Submit for verification",
}: {
  onSubmit: (data: {
    name: string;
    description: string;
    invitedEmails: string[];
    mentor: string;
    resources: string[];
    consumables: string[];
  }) => void;
  initial?: {
    name: string;
    description: string;
    invitedEmails: string[];
    mentor: string;
    kit: ResourceKit;
  };
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [invitedEmails, setInvitedEmails] = useState<string[]>(initial?.invitedEmails ?? []);
  const [mentor, setMentor] = useState(initial?.mentor ?? "");
  const [kit, setKit] = useState<ResourceKit>(initial?.kit ?? emptyKit);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  return (
    <form
      className="min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          description,
          invitedEmails,
          mentor,
          resources: kit.equipment,
          consumables: kit.consumables.map(formatConsumable),
        });
      }}
    >
      <ol className="mb-6 flex items-center gap-2" aria-label="Project creation progress">
        {stepLabels.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          const reached = number <= step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  reached ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "shrink-0 text-[10px] font-mono uppercase tracking-widest transition-colors",
                  number === step ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={number === step ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-5">
          <FloatingInput
            id="p-name"
            label="Project name"
            value={name}
            onChange={setName}
            autoComplete="off"
          />
          <FloatingTextarea
            id="p-desc"
            label="What are you building?"
            value={description}
            onChange={setDescription}
          />
          <button
            type="button"
            disabled={!name.trim() || !description.trim()}
            onClick={() => setStep(2)}
            className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next — the team <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <TeamMembers emails={invitedEmails} onChange={setInvitedEmails} />
          <MentorSelect value={mentor} onValueChange={setMentor} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            <button
              type="button"
              disabled={!mentor}
              onClick={() => setStep(3)}
              className="pressable inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next — the kit <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <ResourceSelection kit={kit} onChange={setKit} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !description.trim() || !mentor}
              className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function FloatingInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        autoComplete={autoComplete}
        className="peer h-14 px-4 pb-2 pt-6 transition-shadow"
      />
      <Label
        htmlFor={id}
        className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-muted-foreground transition-all peer-placeholder-shown:top-[1.1rem] peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary"
      >
        {label}
      </Label>
    </div>
  );
}

function FloatingTextarea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Textarea
        id={id}
        required
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        className="peer min-h-32 resize-none px-4 pb-3 pt-7 transition-shadow"
      />
      <Label
        htmlFor={id}
        className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-muted-foreground transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary"
      >
        {label}
      </Label>
    </div>
  );
}
