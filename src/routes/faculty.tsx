import { createFileRoute } from "@tanstack/react-router";
import { Activity, Archive, CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DashboardQuickActions } from "@/components/DashboardQuickActions";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Project } from "@/lib/makerspace-data";

export const Route = createFileRoute("/faculty")({ component: Faculty });

type View = "pending" | "active" | "history";
const tabs: { id: View; label: string; icon: typeof ClipboardCheck }[] = [
  { id: "pending", label: "Pending review", icon: ClipboardCheck },
  { id: "active", label: "Active projects", icon: CheckCircle2 },
  { id: "history", label: "Project archive", icon: Archive },
];
const prototypeFacultyName = "Prof. Rohan Bhide";

function Faculty() {
  const { projects, updateProject } = useMakerSpace();
  const [view, setView] = useState<View>("pending");
  const [project, setProject] = useState<Project | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const assignedProjects = useMemo(
    () =>
      projects.filter((item) =>
        item.mentor.toLowerCase().includes(prototypeFacultyName.toLowerCase()),
      ),
    [projects],
  );
  const buckets = useMemo(
    () => ({
      pending: assignedProjects.filter((item) => item.status === "Mentor Approval Pending"),
      active: assignedProjects.filter((item) => item.status === "Verified"),
      history: assignedProjects.filter((item) => ["Rejected", "Archived"].includes(item.status)),
    }),
    [assignedProjects],
  );
  const visible = buckets[view];

  function openReview(item: Project) {
    setProject(item);
    setRejecting(false);
    setReason("");
    setReasonError("");
  }
  function approve() {
    if (!project) return;
    updateProject(project.id, {
      status: "Verified",
      reviewedAt: new Date().toLocaleString("en-IN"),
      reviewedBy: prototypeFacultyName,
    });
    setProject(null);
  }
  function reject() {
    if (!project) return;
    if (!reason.trim()) {
      setReasonError("A reason is required so the team knows what to revise.");
      return;
    }
    updateProject(project.id, {
      status: "Rejected",
      rejectionReason: reason.trim(),
      reviewedAt: new Date().toLocaleString("en-IN"),
      reviewedBy: prototypeFacultyName,
    });
    setProject(null);
    setRejecting(false);
  }

  return (
    <AppShell
      title="Faculty workspace"
      subtitle={`${buckets.pending.length} project${buckets.pending.length === 1 ? "" : "s"} awaiting review`}
    >
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Faculty project summary">
        <Summary label="Pending review" value={buckets.pending.length} tone="warning" />
        <Summary label="Active projects" value={buckets.active.length} tone="success" />
        <Summary label="Archived decisions" value={buckets.history.length} tone="muted" />
      </section>

      <DashboardQuickActions
        actions={[
          {
            label: "Review Next Request",
            description: buckets.pending.length
              ? `Open the next of ${buckets.pending.length} projects awaiting your decision.`
              : "Check the pending verification queue.",
            icon: ClipboardCheck,
            onClick: () => {
              setView("pending");
              if (buckets.pending[0]) openReview(buckets.pending[0]);
            },
          },
          {
            label: "Active Mentorships",
            description: "Review projects currently verified under your mentorship.",
            icon: CheckCircle2,
            onClick: () => setView("active"),
          },
          {
            label: "Decision Archive",
            description: "Open previously rejected and archived project decisions.",
            icon: Archive,
            onClick: () => setView("history"),
          },
          {
            label: "Recent Activity",
            description: "Review your latest mentorship decisions and timestamps.",
            icon: Activity,
            onClick: () =>
              document.getElementById("faculty-recent-activity")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              }),
          },
        ]}
      />

      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Project directories"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
              view === id
                ? "bg-primary text-primary-foreground"
                : "border bg-card text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-3">
        {visible.length ? (
          visible.map((item) => (
            <article key={item.id} className="card-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <StatusBadge label={item.status} />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>
                  <strong className="text-foreground">Leader:</strong> {item.leader}
                </span>
                <span>
                  <strong className="text-foreground">Team:</strong> {item.members.length + 1}{" "}
                  {item.members.length === 0 ? "member" : "members"}
                </span>
                <span>
                  <strong className="text-foreground">Submitted:</strong> {item.createdAt}
                </span>
              </div>
              {item.rejectionReason && (
                <p className="mt-3 rounded-xl bg-warning/10 p-3 text-sm text-warning-foreground">
                  <strong>Review note:</strong> {item.rejectionReason}
                </p>
              )}
              <button
                type="button"
                onClick={() => openReview(item)}
                className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                {item.status === "Mentor Approval Pending" ? "Review project" : "View project"}
              </button>
            </article>
          ))
        ) : (
          <EmptyState view={view} />
        )}
      </section>

      <section id="faculty-recent-activity" className="mt-7 scroll-mt-24">
        <h2 className="font-semibold">Recent mentorship activity</h2>
        <div className="mt-3 space-y-2">
          {assignedProjects.some((item) => item.reviewedAt) ? (
            assignedProjects
              .filter((item) => item.reviewedAt)
              .slice(0, 5)
              .map((item) => (
                <article
                  key={item.id}
                  className="card-surface flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reviewed by {item.reviewedBy ?? prototypeFacultyName} · {item.reviewedAt}
                    </p>
                  </div>
                  <StatusBadge label={item.status} />
                </article>
              ))
          ) : (
            <div className="card-surface p-5 text-sm text-muted-foreground">
              Approval and rejection activity will appear here.
            </div>
          )}
        </div>
      </section>

      <ResponsiveModal
        open={!!project}
        onOpenChange={(open) => !open && setProject(null)}
        title={project?.name ?? "Project review"}
        description="Review the submitted project, team and resource requirements."
      >
        {project && (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
            <ReviewDetail label="Project leader" value={project.leader} />
            <ReviewDetail
              label="Team roster"
              value={[
                project.leader,
                ...project.members.map((member) => `${member.name} (${member.prn})`),
              ].join(", ")}
            />
            <ReviewDetail
              label="Expected equipment"
              value={
                project.resources
                  .filter((resource) => !project.consumables?.includes(resource))
                  .join(", ") || "None specified"
              }
            />
            <ReviewDetail
              label="Expected consumables"
              value={project.consumables?.join(", ") || "None specified"}
            />
            <ReviewDetail label="Submission date" value={project.createdAt} />
            {project.reviewedAt && (
              <ReviewDetail
                label="Latest decision"
                value={`${project.reviewedAt} · ${project.reviewedBy ?? prototypeFacultyName}`}
              />
            )}
            {project.rejectionReason && (
              <ReviewDetail label="Previous review note" value={project.rejectionReason} />
            )}
            {project.status === "Mentor Approval Pending" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={approve}
                  className="min-h-12 flex-1 rounded-xl bg-success px-4 font-semibold text-success-foreground"
                >
                  Approve project
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(true)}
                  className="min-h-12 flex-1 rounded-xl border border-destructive/40 px-4 font-semibold text-destructive"
                >
                  Reject project
                </button>
              </div>
            )}
          </div>
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={rejecting}
        onOpenChange={(open) => {
          setRejecting(open);
          if (!open) setReasonError("");
        }}
        title="Reject project"
        description="Explain what must be revised before the team resubmits."
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="rejection-reason">
            Required review reason
          </label>
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError("");
            }}
            placeholder="For example, clarify the equipment requirements and safety considerations."
            className="min-h-28 w-full rounded-xl border bg-card p-3 text-sm"
            aria-invalid={!!reasonError}
          />
          {reasonError && <p className="text-sm text-destructive">{reasonError}</p>}
          <button
            type="button"
            onClick={reject}
            className="min-h-12 w-full rounded-xl bg-destructive px-4 font-semibold text-destructive-foreground"
          >
            Reject with reason
          </button>
        </div>
      </ResponsiveModal>
    </AppShell>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "success" | "muted";
}) {
  return (
    <article className={`card-surface p-4 ${tone === "warning" ? "border-warning/30" : ""}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </article>
  );
}
function ReviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}
function EmptyState({ view }: { view: View }) {
  const content =
    view === "pending"
      ? [
          "No projects are waiting for your decision.",
          "New verification requests will appear here.",
        ]
      : view === "active"
        ? ["No active mentored projects yet.", "Approved projects will be listed here."]
        : ["No archived decisions yet.", "Rejected and archived projects will be retained here."];
  return (
    <div className="card-surface p-8 text-center">
      <XCircle className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 font-semibold">{content[0]}</p>
      <p className="mt-1 text-sm text-muted-foreground">{content[1]}</p>
    </div>
  );
}
