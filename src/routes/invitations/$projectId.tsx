import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, LoaderCircle, Users } from "lucide-react";
import { useState } from "react";
import { requireInvitation } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import type { ProjectDetail } from "@/lib/project-types";

export const Route = createFileRoute("/invitations/$projectId")({
  beforeLoad: requireInvitation,
  component: ProjectInvitation,
});

function ProjectInvitation() {
  const { projectId } = Route.useParams();
  const { client, user } = useAuth();
  const [completed, setCompleted] = useState<"ACCEPTED" | "DECLINED" | null>(null);
  const project = useQuery({
    queryKey: ["project-invitation", projectId],
    queryFn: () => client.api.request<ProjectDetail>(`/projects/${projectId}`),
  });
  const invitation = project.data?.members.find(
    (member) =>
      member.role === "MEMBER" && (member.userId === user?.id || member.email === user?.email),
  );
  const respond = useMutation({
    mutationFn: (decision: "ACCEPTED" | "DECLINED") =>
      client.api.request<ProjectDetail>(`/projects/${projectId}/invitations/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (_, decision) => setCompleted(decision),
  });

  if (project.isLoading) {
    return (
      <InviteShell>
        <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your project invitation…</p>
      </InviteShell>
    );
  }
  if (project.isError || !project.data || !invitation) {
    return (
      <InviteShell>
        <CircleAlert className="mx-auto size-7 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">This invitation is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with the MIT-WPU account that received the invitation, or ask the Team Leader to
          send it again.
        </p>
      </InviteShell>
    );
  }
  if (completed || invitation.status === "ACCEPTED" || invitation.status === "DECLINED") {
    const accepted = completed === "ACCEPTED" || (!completed && invitation.status === "ACCEPTED");
    return (
      <InviteShell>
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <h1 className="mt-4 text-2xl font-bold">
          {accepted ? "You joined the project" : "Invitation declined"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {accepted
            ? `You are now a member of ${project.data.title}.`
            : "The Team Leader can now update the project team."}
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
  if (invitation.status !== "PENDING") {
    return (
      <InviteShell>
        <CircleAlert className="mx-auto size-7 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">Invitation closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invitation was cancelled or has expired.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Users className="size-6" />
      </span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
        Project invitation
      </p>
      <h1 className="mt-2 text-2xl font-bold">Join {project.data.title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{project.data.description}</p>
      <dl className="mt-5 rounded-xl bg-muted p-4 text-left text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Team Leader</dt>
          <dd className="font-semibold">{project.data.leader.name}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <dt className="text-muted-foreground">Faculty Mentor</dt>
          <dd className="font-semibold">{project.data.mentor?.name}</dd>
        </div>
      </dl>
      {respond.isError && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {respond.error instanceof ApiClientError
            ? respond.error.message
            : "Your response could not be saved."}
        </p>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => respond.mutate("ACCEPTED")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          {respond.isPending && <LoaderCircle className="size-4 animate-spin" />} Accept invitation
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => respond.mutate("DECLINED")}
          className="min-h-12 rounded-xl border border-border bg-card px-5 text-sm font-semibold"
        >
          Decline
        </button>
      </div>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="card-surface w-full max-w-lg p-6 text-center sm:p-8">{children}</section>
    </main>
  );
}
