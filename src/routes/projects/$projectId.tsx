import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PersistedProjectDetail } from "@/components/Projects/PersistedProjectDetail";
import { usePersistedProject } from "@/lib/project-queries";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId")({ component: ProjectDetails });

function ProjectDetails() {
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
