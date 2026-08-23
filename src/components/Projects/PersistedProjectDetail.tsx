import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  Check,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  projectsApi,
  referenceApi,
  usersApi,
  type FacultyDirectoryResult,
  type ProjectDetail,
  type StudentDirectoryResult,
} from "@/lib/api";
import { useAppSession } from "@/lib/auth-context";
import {
  invalidateProjectData,
  invitationStatusLabel,
  projectStatusLabel,
} from "@/lib/project-queries";
import { cn } from "@/lib/utils";

export function PersistedProjectDetail({
  project,
  onArchived,
}: {
  project: ProjectDetail;
  onArchived?: () => void;
}) {
  const queryClient = useQueryClient();
  const { user, role } = useAppSession();
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const isLeader = project.viewerRelationship === "LEADER";
  const latestMentorRequest = project.mentorRequests[0];
  const canDecide = Boolean(
    role === "Faculty Mentor" &&
    latestMentorRequest &&
    latestMentorRequest.faculty.id === user?.id &&
    latestMentorRequest.status === "PENDING",
  );
  const ownMembership = project.members.find(
    (member) => member.userId === user?.id || member.email === user?.email,
  );

  const mutate = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => invalidateProjectData(queryClient, project.id),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "The project could not be updated"),
  });

  const decideInvitation = (decision: "ACCEPTED" | "DECLINED") =>
    mutate.mutate(() =>
      projectsApi.respondToInvitation(project.id, decision).then(() => {
        toast.success(
          decision === "ACCEPTED" ? "You joined the project team" : "Invitation declined",
        );
      }),
    );

  const decideMentor = (decision: "APPROVED" | "REJECTED", reason?: string) =>
    mutate.mutate(() =>
      projectsApi.decideMentor(project.id, decision, reason).then(() => {
        toast.success(
          decision === "APPROVED" ? "Project approved" : "Project returned with feedback",
        );
        setRejectOpen(false);
      }),
    );

  return (
    <div className="space-y-6">
      <section className="card-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-2xl font-light tracking-wide">{project.title}</h2>
              <StatusBadge label={projectStatusLabel(project.status)} />
            </div>
            <p className="mt-2 text-sm font-medium text-primary">{project.statusMessage}</p>
          </div>
          {isLeader && project.status !== "ARCHIVED" && (
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => setEditOpen(true)} icon={Pencil}>
                Edit
              </ActionButton>
              <ActionButton onClick={() => setInviteOpen(true)} icon={UserPlus}>
                Invite
              </ActionButton>
              <ActionButton onClick={() => setMentorOpen(true)} icon={ShieldCheck}>
                Change mentor
              </ActionButton>
            </div>
          )}
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {project.description}
        </p>
        {project.rejectionReason && (
          <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/[0.04] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
              Faculty feedback
            </p>
            <p className="mt-1 text-sm">{project.rejectionReason}</p>
          </div>
        )}
      </section>

      {ownMembership?.status === "PENDING" && (
        <section className="card-surface border-primary/25 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Team invitation
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {project.leader.name} invited you to join this project.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={mutate.isPending}
              onClick={() => decideInvitation("ACCEPTED")}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Accept invitation
            </button>
            <button
              type="button"
              disabled={mutate.isPending}
              onClick={() => decideInvitation("DECLINED")}
              className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-5 sm:p-6">
          <SectionTitle>Team</SectionTitle>
          <div className="mt-4 divide-y divide-border">
            {project.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.role === "LEADER" ? "Team Leader" : member.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge label={invitationStatusLabel(member.status)} />
                  {isLeader &&
                    member.role !== "LEADER" &&
                    !["CANCELLED", "EXPIRED"].includes(member.status) && (
                      <button
                        type="button"
                        disabled={mutate.isPending}
                        onClick={() =>
                          mutate.mutate(() =>
                            projectsApi.removeMember(project.id, member.id).then(() => {
                              toast.success(
                                member.status === "ACCEPTED"
                                  ? "Team member removed"
                                  : "Invitation cancelled",
                              );
                            }),
                          )
                        }
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
                        aria-label={
                          member.status === "ACCEPTED"
                            ? `Remove ${member.name}`
                            : `Cancel invitation for ${member.name}`
                        }
                      >
                        <X className="size-4" />
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <SectionTitle>Faculty Mentor</SectionTitle>
          <div className="mt-4">
            <p className="text-sm font-semibold">{project.mentor?.name ?? "Not assigned"}</p>
            <p className="text-xs text-muted-foreground">{project.mentor?.email}</p>
            {latestMentorRequest && (
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge label={invitationStatusLabel(latestMentorRequest.status)} />
                <span className="text-xs text-muted-foreground">
                  Requested {new Date(latestMentorRequest.requestedAt).toLocaleDateString("en-IN")}
                </span>
              </div>
            )}
          </div>
          {canDecide && (
            <div className="mt-5 flex gap-3 border-t border-border pt-4">
              <button
                type="button"
                disabled={mutate.isPending}
                onClick={() => decideMentor("APPROVED")}
                className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={mutate.isPending}
                onClick={() => setRejectOpen(true)}
                className="min-h-11 flex-1 rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ResourceSection
          title="Expected equipment"
          items={project.equipment.map((item) => `${item.name} · ${item.category}`)}
        />
        <ResourceSection
          title="Expected consumables"
          items={project.consumables.map((item) => `${item.name} · ${item.unit}`)}
        />
      </div>

      <section className="card-surface p-5 sm:p-6">
        <SectionTitle>Bookings</SectionTitle>
        {project.bookings.length ? (
          <div className="mt-4 divide-y divide-border">
            {project.bookings.map((booking) =>
              booking.canView ? (
                <Link
                  key={booking.id}
                  to="/bookings/$bookingId"
                  params={{ bookingId: booking.id }}
                  className="flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <ProjectBookingRow booking={booking} linked />
                </Link>
              ) : (
                <div
                  key={booking.id}
                  className="flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <ProjectBookingRow booking={booking} />
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              No bookings have been made for this project.
            </p>
            {isLeader && project.status === "VERIFIED" && (
              <Link
                to="/book"
                search={{ project: project.id }}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
              >
                Find a slot
              </Link>
            )}
          </div>
        )}
      </section>

      {isLeader && project.status !== "ARCHIVED" && (
        <button
          type="button"
          onClick={() => setArchiveOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-destructive"
        >
          <Archive className="size-4" /> Archive project
        </button>
      )}

      <ResponsiveModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Edit ${project.title}`}
        description="Major detail changes require renewed Faculty Mentor approval."
        size="wide"
      >
        <EditProjectForm project={project} onDone={() => setEditOpen(false)} />
      </ResponsiveModal>
      <ResponsiveModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a teammate"
        description="Search registered MIT-WPU Students. Adding a teammate requires renewed verification."
      >
        <InviteMemberForm
          projectId={project.id}
          existingEmails={project.members
            .filter((member) => !["CANCELLED", "EXPIRED"].includes(member.status))
            .map((member) => member.email)}
          onDone={() => setInviteOpen(false)}
        />
      </ResponsiveModal>
      <ResponsiveModal
        open={mentorOpen}
        onOpenChange={setMentorOpen}
        title="Change Faculty Mentor"
        description="The previous approval is revoked and the new mentor must review the project."
      >
        <ChangeMentorForm
          projectId={project.id}
          currentMentorId={project.mentor?.id}
          onDone={() => setMentorOpen(false)}
        />
      </ResponsiveModal>
      <ResponsiveModal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject project"
        description="Give the Team Leader a clear reason. This decision is audited."
      >
        <RejectForm
          pending={mutate.isPending}
          onReject={(reason) => decideMentor("REJECTED", reason)}
        />
      </ResponsiveModal>
      <ResponsiveModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${project.title}?`}
        description="The project remains in history and can no longer be edited."
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setArchiveOpen(false)}
            className="min-h-12 flex-1 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            Keep project
          </button>
          <button
            type="button"
            disabled={mutate.isPending}
            onClick={() =>
              mutate.mutate(() =>
                projectsApi.delete(project.id).then(() => {
                  toast.success("Project archived");
                  setArchiveOpen(false);
                  onArchived?.();
                }),
              )
            }
            className="min-h-12 flex-1 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            Archive project
          </button>
        </div>
      </ResponsiveModal>
    </div>
  );
}

function ProjectBookingRow({
  booking,
  linked = false,
}: {
  booking: ProjectDetail["bookings"][number];
  linked?: boolean;
}) {
  return (
    <>
      <span className="text-sm">{new Date(booking.startsAt).toLocaleString("en-IN")}</span>
      <span className="flex items-center gap-2">
        <StatusBadge label={invitationStatusLabel(booking.status)} />
        {linked && <ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
      </span>
    </>
  );
}

function EditProjectForm({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [equipmentIds, setEquipmentIds] = useState(project.equipment.map((item) => item.id));
  const [consumableIds, setConsumableIds] = useState(project.consumables.map((item) => item.id));
  const resources = useQuery({
    queryKey: ["phase2-reference", "project-resources", project.labId],
    queryFn: () => referenceApi.projectResources(project.labId).then((r) => r.data),
  });
  const mutation = useMutation({
    mutationFn: () =>
      projectsApi.update(project.id, {
        title: title.trim(),
        description: description.trim(),
        equipmentIds,
        consumableIds,
      }),
    onSuccess: async () => {
      await invalidateProjectData(queryClient, project.id);
      toast.success("Project updated");
      onDone();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not update project"),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="edit-project-title">Project name</Label>
        <Input
          id="edit-project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-project-description">Description</Label>
        <Textarea
          id="edit-project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          required
        />
      </div>
      <CompactResourceChecks
        label="Equipment"
        items={resources.data?.equipment ?? []}
        selected={equipmentIds}
        onChange={setEquipmentIds}
      />
      <CompactResourceChecks
        label="Consumables"
        items={resources.data?.consumables ?? []}
        selected={consumableIds}
        onChange={setConsumableIds}
      />
      <button
        type="submit"
        disabled={mutation.isPending || !title.trim() || !description.trim()}
        className="min-h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function InviteMemberForm({
  projectId,
  existingEmails,
  onDone,
}: {
  projectId: string;
  existingEmails: string[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const results = useQuery({
    queryKey: ["phase2-directory", "students", debounced],
    queryFn: () => usersApi.searchStudents(debounced).then((r) => r.data),
    enabled: debounced.length >= 2,
  });
  const mutation = useMutation({
    mutationFn: (student: StudentDirectoryResult) =>
      projectsApi.addMember(projectId, student.email),
    onSuccess: async () => {
      await invalidateProjectData(queryClient, projectId);
      toast.success("Teammate invited");
      onDone();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not invite teammate"),
  });
  return (
    <SearchPicker
      id="invite-student-search"
      label="Student name, email, or PRN"
      search={search}
      onSearch={setSearch}
      loading={results.isFetching}
    >
      {results.data
        ?.filter((student) => !existingEmails.includes(student.email))
        .map((student) => (
          <PickerRow
            key={student.id}
            title={student.name}
            subtitle={`${student.email} · PRN ${student.prn}`}
            onClick={() => mutation.mutate(student)}
            disabled={mutation.isPending}
          />
        ))}
    </SearchPicker>
  );
}

function ChangeMentorForm({
  projectId,
  currentMentorId,
  onDone,
}: {
  projectId: string;
  currentMentorId?: string | undefined;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const results = useQuery({
    queryKey: ["phase2-directory", "faculty", debounced],
    queryFn: () => usersApi.searchFacultyMentors(debounced).then((r) => r.data),
    enabled: debounced.length >= 2,
  });
  const mutation = useMutation({
    mutationFn: (mentor: FacultyDirectoryResult) => projectsApi.requestMentor(projectId, mentor.id),
    onSuccess: async () => {
      await invalidateProjectData(queryClient, projectId);
      toast.success("Faculty Mentor request sent");
      onDone();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not change mentor"),
  });
  return (
    <SearchPicker
      id="change-mentor-search"
      label="Faculty Mentor name or email"
      search={search}
      onSearch={setSearch}
      loading={results.isFetching}
    >
      {results.data
        ?.filter((mentor) => mentor.id !== currentMentorId)
        .map((mentor) => (
          <PickerRow
            key={mentor.id}
            title={mentor.name}
            subtitle={mentor.email}
            onClick={() => mutation.mutate(mentor)}
            disabled={mutation.isPending}
          />
        ))}
    </SearchPicker>
  );
}

function RejectForm({
  pending,
  onReject,
}: {
  pending: boolean;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length >= 3) onReject(reason.trim());
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="mentor-rejection-reason">Reason</Label>
        <Textarea
          id="mentor-rejection-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          minLength={3}
          required
        />
      </div>
      <button
        type="submit"
        disabled={pending || reason.trim().length < 3}
        className="min-h-12 w-full rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
      >
        Reject with reason
      </button>
    </form>
  );
}

function SearchPicker({
  id,
  label,
  search,
  onSearch,
  loading,
  children,
}: {
  id: string;
  label: string;
  search: string;
  onSearch: (value: string) => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          id={id}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="pl-9"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-3.5 size-4 animate-spin text-primary" />
        )}
      </div>
      {search.trim().length < 2 ? (
        <p className="text-xs text-muted-foreground">Enter at least two characters.</p>
      ) : (
        <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function PickerRow({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="text-xs font-semibold text-primary">Select</span>
    </button>
  );
}

function CompactResourceChecks({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <section>
      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(active ? selected.filter((id) => id !== item.id) : [...selected, item.id])
              }
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {item.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ResourceSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <SectionTitle>{title}</SectionTitle>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">None selected.</p>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono uppercase tracking-widest text-primary">{children}</h3>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: typeof Pencil;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-secondary"
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return debounced;
}
