import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import { ResourceSelection } from "@/components/CreateProject/ResourceSelection";
import { TeamMembers } from "@/components/CreateProject/TeamMembers";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireRoles } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import {
  invitationStatusLabel,
  projectStatusLabel,
  type DirectoryUser,
  type ProjectDetail,
} from "@/lib/project-types";

export const Route = createFileRoute("/projects/$projectId")({
  beforeLoad: requireRoles("STUDENT", "FACULTY_MENTOR"),
  component: ProjectDetails,
});

type Editor = "details" | "team" | "mentor" | "resources" | null;

function ProjectDetails() {
  const { projectId } = Route.useParams();
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Editor>(null);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => client.api.request<ProjectDetail>(`/projects/${projectId}`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
  const invitation = project.data?.members.find(
    (member) =>
      member.role === "MEMBER" &&
      member.status === "PENDING" &&
      (member.userId === user?.id || member.email === user?.email),
  );
  const respond = useMutation({
    mutationFn: (decision: "ACCEPTED" | "DECLINED") =>
      client.api.request<ProjectDetail>(`/projects/${projectId}/invitations/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (_, decision) => {
      refresh();
      toast.success(decision === "ACCEPTED" ? "You joined the project." : "Invitation declined.");
    },
  });
  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      client.api.request<ProjectDetail>(`/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      refresh();
      toast.success("Project team updated.");
    },
  });

  if (project.isLoading) {
    return (
      <AppShell title="Project" subtitle="Loading project details">
        <div className="grid min-h-64 place-items-center rounded-2xl border border-border bg-card">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Loading project…
          </p>
        </div>
      </AppShell>
    );
  }
  if (project.isError || !project.data) {
    return (
      <AppShell title="Project unavailable">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm text-destructive">
            This project does not exist or is outside your permitted workspace.
          </p>
          <Link
            to="/projects"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <ArrowLeft className="size-4" /> Back to projects
          </Link>
        </div>
      </AppShell>
    );
  }

  const data = project.data;
  const isLeader = data.creatorId === user?.id;
  const latestMentorRequest = data.mentorRequests[0];
  const activeMembers = data.members.filter(
    (member) => member.status !== "CANCELLED" && member.status !== "EXPIRED",
  );

  return (
    <AppShell title={data.title} subtitle="Project workspace">
      <Link
        to="/projects"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="size-4" /> All projects
      </Link>

      {invitation && (
        <section
          className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-5"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">You are invited to join this project</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Accept to become a project member, or decline so the Team Leader can update the
                team.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate("ACCEPTED")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
                >
                  <CheckCircle2 className="size-4" /> Accept invitation
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
            </div>
          </div>
        </section>
      )}

      <section className="card-surface overflow-hidden">
        <div className="border-b border-border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Project overview
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Submitted {formatDate(data.submittedAt ?? data.createdAt)} by {data.leader.name}
              </p>
            </div>
            <StatusBadge label={projectStatusLabel[data.status]} />
          </div>
          <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6">{data.description}</p>
          {data.rejectionReason && (
            <div className="mt-5 flex gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
              <CircleAlert className="size-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Faculty Mentor feedback</p>
                <p className="mt-1 text-sm">{data.rejectionReason}</p>
              </div>
            </div>
          )}
          {isLeader && data.status !== "ARCHIVED" && (
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton
                icon={Pencil}
                label="Edit details"
                onClick={() => setEditor("details")}
              />
              <ActionButton icon={Plus} label="Manage team" onClick={() => setEditor("team")} />
              <ActionButton
                icon={UserRoundCheck}
                label="Change mentor"
                onClick={() => setEditor("mentor")}
              />
              <ActionButton
                icon={Boxes}
                label="Update resources"
                onClick={() => setEditor("resources")}
              />
            </div>
          )}
        </div>

        <div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <section className="p-5 sm:p-6" aria-labelledby="team-title">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 id="team-title" className="font-semibold">
                Team
              </h2>
            </div>
            <ul className="mt-4 space-y-3">
              {activeMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-muted px-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.role === "LEADER"
                        ? "Team Leader"
                        : member.status === "PENDING" && member.invitationEmailStatus === "PENDING"
                          ? "Email invitation queued"
                          : invitationStatusLabel(member.status)}{" "}
                      · {member.email}
                    </p>
                  </div>
                  {isLeader && member.role !== "LEADER" && (
                    <button
                      type="button"
                      disabled={removeMember.isPending}
                      onClick={() => removeMember.mutate(member.id)}
                      aria-label={`${member.status === "ACCEPTED" ? "Remove" : "Cancel invitation for"} ${member.name}`}
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="p-5 sm:p-6" aria-labelledby="mentor-title">
            <div className="flex items-center gap-2">
              <UserRoundCheck className="size-5 text-primary" />
              <h2 id="mentor-title" className="font-semibold">
                Faculty Mentor
              </h2>
            </div>
            <div className="mt-4 rounded-xl bg-muted p-4">
              <p className="font-semibold">{data.mentor?.name ?? "No Faculty Mentor selected"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{data.mentor?.email}</p>
              {latestMentorRequest && (
                <p className="mt-3 text-xs font-semibold">
                  {mentorRequestLabel(latestMentorRequest.status)}
                  {latestMentorRequest.respondedAt
                    ? ` · ${formatDate(latestMentorRequest.respondedAt)}`
                    : ""}
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ResourceCard
          title="Expected equipment"
          items={data.equipment.map((item) => `${item.name} · ${item.category}`)}
        />
        <ResourceCard
          title="Expected consumables"
          items={data.consumables.map((item) => `${item.name} · ${item.category}`)}
        />
      </div>

      <section className="card-surface mt-5 p-5 sm:p-6" aria-labelledby="bookings-title">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" />
          <h2 id="bookings-title" className="font-semibold">
            Bookings
          </h2>
        </div>
        {data.bookings.length ? (
          <ul className="mt-4 space-y-2">
            {data.bookings.map((booking) => (
              <li key={booking.id} className="rounded-xl bg-muted p-3 text-sm">
                {formatDateTime(booking.startsAt)} · {booking.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No bookings yet. Verified Team Leaders can book when the Phase 4 booking flow is
            connected.
          </p>
        )}
      </section>

      <ResponsiveModal
        open={Boolean(editor)}
        onOpenChange={(open) => !open && setEditor(null)}
        title={editorTitle(editor)}
        description="Changes are saved to the shared project record."
      >
        {editor === "details" && (
          <DetailsEditor
            project={data}
            onDone={() => {
              setEditor(null);
              refresh();
            }}
          />
        )}
        {editor === "team" && (
          <TeamEditor
            project={data}
            onDone={() => {
              setEditor(null);
              refresh();
            }}
          />
        )}
        {editor === "mentor" && (
          <MentorEditor
            project={data}
            onDone={() => {
              setEditor(null);
              refresh();
            }}
          />
        )}
        {editor === "resources" && (
          <ResourcesEditor
            project={data}
            onDone={() => {
              setEditor(null);
              refresh();
            }}
          />
        )}
      </ResponsiveModal>
    </AppShell>
  );
}

function DetailsEditor({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const { client } = useAuth();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const mutation = useMutation({
    mutationFn: () =>
      client.api.request(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      }),
    onSuccess: () => {
      toast.success("Project details updated.");
      onDone();
    },
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="edit-title">Project name</Label>
        <Input
          id="edit-title"
          className="h-12"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <ReverificationNotice>
        Changing major project details sends the project back for Faculty Mentor verification.
      </ReverificationNotice>
      <MutationError mutation={mutation} />
      <SubmitButton
        pending={mutation.isPending}
        disabled={title.trim().length < 2 || !description.trim()}
      >
        Save project details
      </SubmitButton>
    </form>
  );
}

function TeamEditor({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const { client } = useAuth();
  const [members, setMembers] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: async () => {
      for (const email of members) {
        await client.api.request(`/projects/${project.id}/members`, {
          method: "POST",
          body: JSON.stringify({ email }),
        });
      }
    },
    onSuccess: () => {
      toast.success("Team invitations sent.");
      onDone();
    },
  });
  return (
    <div className="space-y-5">
      <TeamMembers members={members} onChange={setMembers} />
      <MutationError mutation={mutation} />
      <SubmitButton
        pending={mutation.isPending}
        disabled={!members.length}
        onClick={() => mutation.mutate()}
      >
        Send invitations
      </SubmitButton>
    </div>
  );
}

function MentorEditor({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const { client } = useAuth();
  const [mentor, setMentor] = useState<DirectoryUser | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      client.api.request(`/projects/${project.id}/mentor-requests`, {
        method: "POST",
        body: JSON.stringify({ facultyId: mentor!.id }),
      }),
    onSuccess: () => {
      toast.success("Faculty Mentor request sent.");
      onDone();
    },
  });
  return (
    <div className="space-y-5">
      <MentorSelect value={mentor} onValueChange={setMentor} />
      <ReverificationNotice>
        Changing the Faculty Mentor revokes the previous approval and requires the new mentor to
        approve.
      </ReverificationNotice>
      <MutationError mutation={mutation} />
      <SubmitButton
        pending={mutation.isPending}
        disabled={!mentor}
        onClick={() => mutation.mutate()}
      >
        Request verification
      </SubmitButton>
    </div>
  );
}

function ResourcesEditor({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const { client } = useAuth();
  const [equipmentIds, setEquipmentIds] = useState(project.equipment.map((item) => item.id));
  const [consumableIds, setConsumableIds] = useState(project.consumables.map((item) => item.id));
  const mutation = useMutation({
    mutationFn: () =>
      client.api.request(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ equipmentIds, consumableIds }),
      }),
    onSuccess: () => {
      toast.success("Expected resources updated.");
      onDone();
    },
  });
  return (
    <div className="space-y-5">
      <ResourceSelection
        labId={project.labId}
        equipmentIds={equipmentIds}
        consumableIds={consumableIds}
        onEquipmentChange={setEquipmentIds}
        onConsumableChange={setConsumableIds}
      />
      <p className="text-xs text-muted-foreground">
        Resource changes remain advisory and do not reserve stock or invalidate mentor approval in
        Version 1.
      </p>
      <MutationError mutation={mutation} />
      <SubmitButton pending={mutation.isPending} onClick={() => mutation.mutate()}>
        Save expected resources
      </SubmitButton>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-accent"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function ResourceCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item} className="rounded-full bg-muted px-3 py-2 text-xs font-semibold">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">None declared for this project.</p>
      )}
    </section>
  );
}

function ReverificationNotice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-warning/10 p-3 text-xs text-foreground">{children}</p>;
}

function MutationError({ mutation }: { mutation: { isError: boolean; error: unknown } }) {
  if (!mutation.isError) return null;
  const message =
    mutation.error instanceof ApiClientError
      ? (mutation.error.details[0]?.message ?? mutation.error.message)
      : "The change could not be saved.";
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  );
}

function SubmitButton({
  children,
  pending,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  pending: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled || pending}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-50"
    >
      {pending && <LoaderCircle className="size-5 animate-spin" />}
      {pending ? "Saving…" : children}
    </button>
  );
}

function editorTitle(editor: Editor) {
  return {
    details: "Edit project details",
    team: "Invite team members",
    mentor: "Change Faculty Mentor",
    resources: "Update expected resources",
  }[editor ?? "details"];
}
function mentorRequestLabel(status: ProjectDetail["mentorRequests"][number]["status"]) {
  return {
    PENDING: "Waiting for approval",
    APPROVED: "Approved",
    REJECTED: "Changes requested",
    CANCELLED: "Request cancelled",
  }[status];
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
