import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
export const Route = createFileRoute("/projects/$projectId")({ component: ProjectDetails });
function ProjectDetails() {
  const { projectId } = Route.useParams();
  const { projects, profile, updateProject } = useMakerSpace();
  const project = projects.find((item) => item.id === projectId);
  if (!project)
    return (
      <AppShell title="Project not found">
        <Link to="/projects" className="text-primary">
          Back to projects
        </Link>
      </AppShell>
    );
  return (
    <AppShell title={project.name} subtitle="Project detail">
      <section className="card-surface p-6">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Led by {project.leader}</p>
            <p className="mt-3 max-w-2xl text-sm">{project.description}</p>
          </div>
          <StatusBadge label={project.status} />
        </div>
        {project.rejectionReason && (
          <p className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            Faculty feedback: {project.rejectionReason}
          </p>
        )}
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">Team</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>{project.leader} · Team Leader</li>
              {project.members.map((member) => (
                <li key={member.id}>
                  {member.name} · {member.department}
                </li>
              ))}
              {project.invitedEmails.map((email) => (
                <li key={email} className="text-muted-foreground">
                  {email} · Invitation pending
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Expected resources</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {project.resources.map((resource) => (
                <li key={resource}>{resource}</li>
              ))}
            </ul>
          </div>
        </div>
        {project.leader === profile.fullName && project.status === "Draft" && (
          <button
            onClick={() =>
              updateProject(project.id, {
                status: project.invitedEmails.length
                  ? "Team Acceptance Pending"
                  : "Mentor Approval Pending",
              })
            }
            className="mt-6 min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Submit for verification
          </button>
        )}
      </section>
    </AppShell>
  );
}
