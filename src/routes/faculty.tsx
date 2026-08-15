import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Project } from "@/lib/makerspace-data";
import { requireRoles } from "@/lib/auth-guards";
export const Route = createFileRoute("/faculty")({
  beforeLoad: requireRoles("FACULTY_MENTOR"),
  component: Faculty,
});
function Faculty() {
  const { projects, updateProject } = useMakerSpace();
  const [project, setProject] = useState<Project | null>(null);
  const [reason, setReason] = useState("");
  const pending = projects.filter((p) => p.status === "Mentor Approval Pending");
  return (
    <AppShell title="Faculty workspace" subtitle={`${pending.length} pending approvals`}>
      <div className="grid gap-4 lg:grid-cols-2">
        {projects
          .filter((p) => p.mentor.includes("Rohan") || p.status === "Mentor Approval Pending")
          .map((p) => (
            <article key={p.id} className="card-surface p-5">
              <div className="flex justify-between gap-3">
                <h2 className="font-semibold">{p.name}</h2>
                <StatusBadge label={p.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Leader: {p.leader} · {p.members.length + 1} members
              </p>
              <button
                onClick={() => setProject(p)}
                className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Review project
              </button>
            </article>
          ))}
      </div>
      <ResponsiveModal
        open={!!project}
        onOpenChange={(open) => !open && setProject(null)}
        title={project?.name ?? "Project review"}
        description="Review the team and expected resources."
      >
        {project && (
          <div className="space-y-5">
            <p className="text-sm">{project.description}</p>
            <p className="text-sm">
              <strong>Team:</strong> {project.leader},{" "}
              {project.members.map((m) => m.name).join(", ")}
            </p>
            <p className="text-sm">
              <strong>Resources:</strong> {project.resources.join(", ")}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason required when rejecting"
              className="min-h-24 w-full rounded-xl border p-3 text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  updateProject(project.id, { status: "Verified" });
                  setProject(null);
                }}
                className="min-h-12 flex-1 rounded-xl bg-success px-4 font-semibold text-success-foreground"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  updateProject(project.id, {
                    status: "Rejected",
                    rejectionReason: reason || "Please revise and resubmit.",
                  });
                  setProject(null);
                }}
                className="min-h-12 flex-1 rounded-xl border border-destructive text-destructive font-semibold"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>
    </AppShell>
  );
}
