import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppSession } from "@/lib/auth-context";
import { ApiError, projectsApi } from "@/lib/api";
import { invalidateProjectData, usePersistedProject } from "@/lib/project-queries";

export const Route = createFileRoute("/invitations/$projectId")({
  component: ProjectInvitation,
});

function ProjectInvitation() {
  const { projectId } = Route.useParams();
  const { authenticated, onboarded, user } = useAppSession();
  const queryClient = useQueryClient();
  const project = usePersistedProject(projectId, authenticated);
  const membership = project.data?.members.find(
    (member) => member.userId === user?.id || member.email === user?.email,
  );
  const mutation = useMutation({
    mutationFn: (decision: "ACCEPTED" | "DECLINED") =>
      projectsApi.respondToInvitation(projectId, decision),
    onSuccess: async (_response, decision) => {
      await invalidateProjectData(queryClient, projectId);
      toast.success(
        decision === "ACCEPTED" ? "You joined the project team" : "Invitation declined",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not respond to the invitation",
      ),
  });
  if (!authenticated) {
    return (
      <InviteShell>
        <CircleAlert className="mx-auto size-7 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">Sign in to view this invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the MIT-WPU account that received this project invitation.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Sign in with MIT-WPU
        </Link>
      </InviteShell>
    );
  }
  if (!onboarded) {
    return (
      <InviteShell>
        <h1 className="text-2xl font-bold">Complete your Student profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your profile is required before responding to a project invitation.
        </p>
        <Link
          to="/onboarding"
          search={{ invite: projectId }}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Complete profile
        </Link>
      </InviteShell>
    );
  }
  if (project.isLoading)
    return (
      <InviteShell>
        <p className="text-sm text-muted-foreground">Loading invitation…</p>
      </InviteShell>
    );
  if (!project.data || !membership || membership.role === "LEADER") {
    return (
      <InviteShell>
        <CircleAlert className="mx-auto size-7 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">This invitation is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may belong to another account, have expired, or have been cancelled.
        </p>
      </InviteShell>
    );
  }
  if (membership.status === "ACCEPTED" || mutation.data?.data.viewerMemberStatus === "ACCEPTED") {
    return (
      <InviteShell>
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <h1 className="mt-4 text-2xl font-bold">You joined the project team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {project.data.title} is now available in your projects.
        </p>
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          View project
        </Link>
      </InviteShell>
    );
  }
  if (membership.status !== "PENDING") {
    return (
      <InviteShell>
        <CircleAlert className="mx-auto size-7 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">Invitation {membership.status.toLowerCase()}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invitation has already been resolved.
        </p>
      </InviteShell>
    );
  }
  return (
    <InviteShell>
      <h1 className="text-2xl font-bold">Join {project.data.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {project.data.leader.name} invited you to this MakerSpace project.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("ACCEPTED")}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <CheckCircle2 className="size-5" /> Accept invitation
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("DECLINED")}
          className="min-h-12 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50"
        >
          Decline
        </button>
      </div>
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
