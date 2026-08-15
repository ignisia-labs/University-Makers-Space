import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMakerSpace } from "@/lib/makerspace-context";
import { TeamMembers } from "@/components/CreateProject/TeamMembers";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import { ResourceSelection } from "@/components/CreateProject/ResourceSelection";

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
  const { projects, profile, addProject } = useMakerSpace();
  const [open, setOpen] = useState(false);

  return (
    <AppShell title="Projects" subtitle={`${projects.length} projects registered`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
      >
        <Plus className="size-5" /> New Project
      </button>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
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
              <Users className="size-4" /> {project.members.length + 1} members
            </p>
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="mt-4 block text-sm font-semibold text-primary"
            >
              View project details
            </Link>
          </article>
        ))}
      </div>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Create a project"
        description="Register your build, invite your team and request mentor verification."
      >
        <ProjectWizard
          onSubmit={(data) => {
            addProject({
              ...data,
              leader: profile.fullName,
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
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [mentor, setMentor] = useState("");
  const [resources, setResources] = useState<string[]>([]);
  const [screen, setScreen] = useState<"details" | "resources">("details");

  return (
    <form
      className="min-w-0 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, description, invitedEmails, mentor, resources });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="p-name">Project name</Label>
        <Input
          id="p-name"
          required
          className="h-12"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Solar Tracking Panel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-desc">Description</Label>
        <Textarea
          id="p-desc"
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you building and why?"
        />
      </div>

      {screen === "details" ? (
        <>
          <TeamMembers emails={invitedEmails} onChange={setInvitedEmails} />
          <MentorSelect value={mentor} onValueChange={setMentor} />
          <button
            type="button"
            onClick={() => setScreen("resources")}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border border-border bg-card px-6 text-base font-semibold hover:bg-accent"
          >
            Choose resources{resources.length ? ` (${resources.length})` : ""}
          </button>
        </>
      ) : (
        <>
          <ResourceSelection selected={resources} onChange={setResources} />
          <button
            type="button"
            onClick={() => setScreen("details")}
            className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to project details
          </button>
        </>
      )}

      {screen === "resources" && (
        <button
          type="submit"
          disabled={!name.trim() || !description.trim() || !mentor}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Submit for Verification
        </button>
      )}
    </form>
  );
}
