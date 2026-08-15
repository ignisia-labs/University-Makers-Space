import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { useMakerSpace } from "@/lib/makerspace-context";
import { requireInvitation } from "@/lib/auth-guards";

export const Route = createFileRoute("/invitations/$projectId")({
  beforeLoad: requireInvitation,
  component: ProjectInvitation,
});

function ProjectInvitation() {
  const { projectId } = Route.useParams();
  const { profile, onboarded, projects, acceptProjectInvitation } = useMakerSpace();
  const project = projects.find((item) => item.id === projectId);
  const isInvited = project?.invitedEmails.some(
    (email) => email.toLowerCase() === profile.email.toLowerCase(),
  );

  if (!project || !isInvited) {
    return (
      <InviteShell>
        <CircleAlert className="mx-auto size-7 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">This invitation is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with the MIT-WPU email address that received the invitation.
        </p>
      </InviteShell>
    );
  }

  if (!onboarded) {
    return (
      <InviteShell>
        <h1 className="text-2xl font-bold">Join {project.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete your profile before accepting this project invitation.
        </p>
        <Link
          to="/onboarding"
          search={{ invite: projectId }}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Complete profile
        </Link>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <h1 className="text-2xl font-bold">Join {project.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You will be added to this project team as {profile.fullName}.
      </p>
      <button
        type="button"
        onClick={() => {
          acceptProjectInvitation(projectId, profile);
          toast.success("You have joined the project team.");
        }}
        className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <CheckCircle2 className="size-5" /> Accept invitation
      </button>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="card-surface w-full max-w-md p-6 text-center">{children}</section>
    </main>
  );
}
