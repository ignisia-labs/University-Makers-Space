import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProjectDetailPanel } from "@/components/Projects/ProjectDetailPanel";
import { useMakerSpace } from "@/lib/makerspace-context";

export const Route = createFileRoute("/projects/$projectId")({ component: ProjectDetails });

function ProjectDetails() {
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
