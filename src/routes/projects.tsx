import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ProjectDetailPanel } from "@/components/Projects/ProjectDetailPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMakerSpace } from "@/lib/makerspace-context";
import { TeamMembers } from "@/components/CreateProject/TeamMembers";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import { ResourceSelection } from "@/components/CreateProject/ResourceSelection";
import { splitResourceSelection } from "@/lib/project-resources";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects hub — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Create projects, invite team members, pick a faculty mentor and submit for verification.",
      },
      { property: "og:title", content: "Projects hub — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Manage your MakerSpace projects and submit them for mentor verification.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, profile, reservations, addProject, updateProject } = useMakerSpace();
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const visibleProjects = projects.filter(
    (project) =>
      project.leader.toLowerCase() === profile.fullName.toLowerCase() ||
      project.members.some((member) => member.email?.toLowerCase() === profile.email.toLowerCase()),
  );

  return (
    <AppShell
      title="Projects"
      subtitle={`${visibleProjects.length} ${visibleProjects.length === 1 ? "project" : "projects"}`}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
      >
        <Plus className="size-5" /> New Project
      </button>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {visibleProjects.map((project) => (
          <article key={project.id} className="card-surface p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <h2 className="min-w-0 truncate text-lg font-semibold">{project.name}</h2>
              <StatusBadge label={project.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Leader</dt>
                <dd className="font-medium">
                  {project.leader}
                  {project.leader === profile.fullName && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                      You
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Mentor</dt>
                <dd className="font-medium">{project.mentor}</dd>
              </div>
            </dl>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="size-4" /> {project.members.length + 1}{" "}
              {project.members.length === 0 ? "member" : "members"}
            </p>
            <button
              type="button"
              onClick={() => setSelectedProjectId(project.id)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              View project details <ArrowRight className="size-4" />
            </button>
          </article>
        ))}
      </div>
      {!visibleProjects.length && (
        <section className="card-surface mt-5 p-8 text-center sm:p-10">
          <p className="text-lg font-semibold">Start building something</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Create a project, invite your team and choose a Faculty Mentor before reserving
            MakerSpace time.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pressable mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Create Project
          </button>
        </section>
      )}

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Create a project"
        description="Register your build, invite your team and request mentor verification."
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
        desktopScrollable={false}
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
          />
        )}
      </ResponsiveModal>
    </AppShell>
  );
}

function ProjectWizard({
  onSubmit,
}: {
  onSubmit: (data: {
    name: string;
    description: string;
    invitedEmails: string[];
    mentor: string;
    resources: string[];
    consumables: string[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [mentor, setMentor] = useState("");
  const [resources, setResources] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepLabels = ["Project brief", "Team & mentor", "Resources"];

  return (
    <form
      className="min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        const splitResources = splitResourceSelection(resources);
        onSubmit({
          name,
          description,
          invitedEmails,
          mentor,
          resources: splitResources.equipment,
          consumables: splitResources.consumables,
        });
      }}
    >
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Project creation progress">
        {stepLabels.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          const complete = number < step;
          const current = number === step;
          return (
            <li key={label} className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                    complete
                      ? "border-success bg-success text-success-foreground"
                      : current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {complete ? <Check className="size-4" /> : number}
                </span>
                {index < stepLabels.length - 1 && (
                  <span
                    className={`h-0.5 flex-1 rounded-full ${complete ? "bg-success" : "bg-border"}`}
                  />
                )}
              </div>
              <p
                className={`mt-2 truncate text-[11px] font-semibold sm:text-xs ${
                  current || complete ? "text-foreground" : "text-muted-foreground"
                }`}
                aria-current={current ? "step" : undefined}
              >
                {label}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border bg-muted/30 p-4 sm:p-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold">Tell us what you are building</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep the project brief clear enough for your Faculty Mentor to review.
              </p>
            </div>
            <FloatingInput
              id="p-name"
              label="Project name"
              value={name}
              onChange={setName}
              autoComplete="off"
            />
            <FloatingTextarea
              id="p-desc"
              label="Project abstract"
              value={description}
              onChange={setDescription}
            />
            <button
              type="button"
              disabled={!name.trim() || !description.trim()}
              onClick={() => setStep(2)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              Continue to team <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Step 2</p>
              <h2 className="mt-1 text-lg font-semibold">Build your review team</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite students by institutional email and nominate one Faculty Mentor.
              </p>
            </div>
            <TeamMembers emails={invitedEmails} onChange={setInvitedEmails} />
            <MentorSelect value={mentor} onValueChange={setMentor} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card px-5 text-sm font-semibold hover:bg-accent"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <button
                type="button"
                disabled={!mentor}
                onClick={() => setStep(3)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Choose resources <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Step 3</p>
              <h2 className="mt-1 text-lg font-semibold">Plan your MakerSpace resources</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select only what the team expects to use during the project.
              </p>
            </div>
            <ResourceSelection selected={resources} onChange={setResources} />
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-semibold">Ready for verification</p>
              <p className="mt-1 text-muted-foreground">
                {name} · {invitedEmails.length} invited · {resources.length} resources selected
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card px-5 text-sm font-semibold hover:bg-accent"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !description.trim() || !mentor}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Submit for Verification
              </button>
            </div>
          </div>
        )}
      </div>
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
