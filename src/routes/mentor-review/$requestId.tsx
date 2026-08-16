import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, LoaderCircle, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type MentorEmailReview = {
  requestId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  requestedAt: string;
  respondedAt: string | null;
  faculty: { name: string; email: string };
  project: {
    id: string;
    title: string;
    description: string;
    status: string;
    submittedAt: string | null;
    leader: { name: string; email: string };
    members: Array<{ name: string; email: string; role: string; status: string }>;
    equipment: Array<{ name: string; category: string }>;
    consumables: Array<{ name: string; unit: string }>;
  };
};

type DecisionResult = {
  projectId: string;
  projectStatus: string;
  decision: "APPROVED" | "REJECTED";
};

export const Route = createFileRoute("/mentor-review/$requestId")({
  component: MentorReview,
});

function MentorReview() {
  const { requestId } = Route.useParams();
  const { client } = useAuth();
  const [token, setToken] = useState("");
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setToken(fragment.get("token") ?? "");
    setTokenLoaded(true);
  }, []);
  const review = useQuery({
    queryKey: ["mentor-email-review", requestId, token],
    queryFn: () =>
      client.api.publicRequest<MentorEmailReview>(
        `/projects/mentor-requests/${requestId}/email-review`,
        { method: "POST", body: JSON.stringify({ token }) },
      ),
    enabled: tokenLoaded && Boolean(token),
  });
  const decision = useMutation({
    mutationFn: (choice: "APPROVED" | "REJECTED") =>
      client.api.publicRequest<DecisionResult>(
        `/projects/mentor-requests/${requestId}/email-decision`,
        {
          method: "POST",
          body: JSON.stringify({
            token,
            decision: choice,
            ...(choice === "REJECTED" ? { reason } : {}),
          }),
        },
      ),
  });

  if (!tokenLoaded || review.isLoading) return <LoadingState />;
  if (review.isError || !review.data) {
    const message =
      review.error instanceof ApiClientError
        ? review.error.message
        : "This Faculty Mentor link is unavailable or has expired.";
    return <MessageState title="This review link is unavailable" body={message} warning />;
  }

  const { project } = review.data;
  const resolved = decision.data ?? (review.data.status === "PENDING" ? null : review.data);
  if (resolved) {
    const approved =
      "decision" in resolved ? resolved.decision === "APPROVED" : review.data.status === "APPROVED";
    return (
      <MessageState
        title={approved ? "Decision recorded" : "Changes requested"}
        body={
          approved
            ? `${project.title} has been approved. The Team Leader has been notified.`
            : `The Team Leader has been notified${review.data.reason ? `: ${review.data.reason}` : "."}`
        }
        success={approved}
      />
    );
  }

  const canReject = reason.trim().length >= 3 && !decision.isPending;
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          MIT-WPU MakerSpace
        </p>
        <h1 className="mt-2 text-3xl font-bold">Review project verification</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are reviewing this request as {review.data.faculty.name}. No app sign-in is required
          for this secure email link.
        </p>

        <article className="card-surface mt-6 p-5 sm:p-7">
          <h2 className="text-xl font-bold">{project.title}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {project.description}
          </p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-muted p-4">
              <dt className="text-xs font-medium text-muted-foreground">Team Leader</dt>
              <dd className="mt-1 font-semibold">{project.leader.name}</dd>
              <dd className="text-muted-foreground">{project.leader.email}</dd>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <dt className="text-xs font-medium text-muted-foreground">Team</dt>
              <dd className="mt-1 font-semibold">{project.members.length} members</dd>
              <dd className="mt-1 text-xs text-muted-foreground">
                {project.members.map((member) => `${member.name} · ${member.status}`).join("\n")}
              </dd>
            </div>
          </dl>

          <ReviewList
            title="Expected equipment"
            rows={project.equipment.map((item) => `${item.name} · ${item.category}`)}
          />
          <ReviewList
            title="Expected consumables"
            rows={project.consumables.map((item) => `${item.name} · ${item.unit}`)}
          />

          {decision.isError && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {decision.error instanceof ApiClientError
                ? decision.error.message
                : "The decision could not be saved. Please try again."}
            </p>
          )}
          {rejecting ? (
            <div className="mt-6 space-y-3 rounded-xl border border-border p-4">
              <label htmlFor="rejection-reason" className="text-sm font-semibold">
                What should the team change?
              </label>
              <textarea
                id="rejection-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                placeholder="Give the Team Leader a clear reason."
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!canReject}
                  onClick={() => decision.mutate("REJECTED")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {decision.isPending && <LoaderCircle className="size-4 animate-spin" />} Send
                  changes requested
                </button>
                <button
                  type="button"
                  disabled={decision.isPending}
                  onClick={() => setRejecting(false)}
                  className="min-h-12 rounded-xl border border-border px-5 text-sm font-semibold"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={decision.isPending}
                onClick={() => decision.mutate("APPROVED")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {decision.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Approve project
              </button>
              <button
                type="button"
                disabled={decision.isPending}
                onClick={() => setRejecting(true)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold"
              >
                <XCircle className="size-4" /> Request changes
              </button>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

function ReviewList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {rows.map((row) => (
            <li key={row} className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {row}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">None declared.</p>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" /> Loading project review…
      </p>
    </main>
  );
}

function MessageState({
  title,
  body,
  success = false,
  warning = false,
}: {
  title: string;
  body: string;
  success?: boolean;
  warning?: boolean;
}) {
  const Icon = success ? CheckCircle2 : CircleAlert;
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="card-surface w-full max-w-lg p-7 text-center">
        <Icon
          className={`mx-auto size-9 ${success ? "text-success" : warning ? "text-warning" : "text-primary"}`}
        />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        <a
          href="/"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"
        >
          <Send className="size-4" /> Open MakerSpace
        </a>
      </section>
    </main>
  );
}
