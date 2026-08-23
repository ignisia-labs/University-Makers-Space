import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProjectDetailPanel } from "@/components/Projects/ProjectDetailPanel";
import { PersistedProjectDetail } from "@/components/Projects/PersistedProjectDetail";
import { useMakerSpace } from "@/lib/makerspace-context";
import { useAppSession } from "@/lib/auth-context";
import { usePersistedProject } from "@/lib/project-queries";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId")({ component: ProjectDetails });

function ProjectDetails() {
  const { prototype } = useAppSession();
  return prototype ? <PrototypeProjectDetails /> : <PersistedProjectDetails />;
}

function PersistedProjectDetails() {
  const { projectId } = Route.useParams();
  const project = usePersistedProject(projectId);
  const navigate = useNavigate();
  if (project.isLoading) {
    return (
      <AppShell title="Project">
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">
          Loading project details…
        </div>
      </AppShell>
    );
  }
  if (!project.data) {
    return (
      <AppShell title="Project not found">
        <Link to="/projects" className="inline-flex min-h-11 items-center gap-2 text-primary">
          <ArrowLeft className="size-4" /> Back to projects
        </Link>
      </AppShell>
    );
  }
  return (
    <AppShell title={project.data.title} subtitle="Project details and verification readiness">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/projects"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to projects
        </Link>
        <PersistedProjectDetail
          project={project.data}
          onArchived={() => void navigate({ to: "/projects", replace: true })}
        />
      </div>
    </AppShell>
  );
}

function PrototypeProjectDetails() {
  const { projectId } = Route.useParams();
  const { projects, profile, reservations, updateProject } = useMakerSpace();
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    return (
      <AppShell title="Project not found">
        <Link to="/projects" className="inline-flex min-h-11 items-center gap-2 text-primary">
          <ArrowLeft className="size-4" /> Back to projects
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell title={project.name} subtitle="Project details and verification readiness">
      <Link
        to="/projects"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to projects
      </Link>
      <ProjectDetailPanel
        project={project}
        profile={profile}
        reservations={reservations.filter((reservation) => reservation.projectId === project.id)}
        onSubmitForVerification={() =>
          updateProject(project.id, {
            status: project.invitedEmails.length
              ? "Team Acceptance Pending"
              : "Mentor Approval Pending",
          })
        }
      />
    </AppShell>
  );
}
