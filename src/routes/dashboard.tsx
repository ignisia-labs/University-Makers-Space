import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  FolderKanban,
  Footprints,
  Plus,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import type { Equipment, Project, Reservation, StudentProfile } from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Student dashboard — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Track your project verification progress, upcoming MakerSpace reservation and next useful actions.",
      },
      { property: "og:title", content: "Student dashboard — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Your MakerSpace progress, reservations and next useful actions.",
      },
    ],
  }),
  component: Dashboard,
});

const steps = ["Create Project", "Get Verified", "Book Slot", "Visit MakerSpace"];

type ProjectRelationship = "leader" | "member" | "invited";
type DashboardProject = Project & { relationship: ProjectRelationship };

function Dashboard() {
  const { profile, projects, reservations, equipment } = useMakerSpace();
  const data = useMemo(
    () => getDashboardData(profile, projects, reservations),
    [profile, projects, reservations],
  );
  const upcomingProject = data.upcoming
    ? data.projects.find((project) => project.id === data.upcoming?.projectId)
    : undefined;
  const journeyProject =
    upcomingProject ??
    data.leaderProjects.find((project) => project.status !== "Archived") ??
    data.projects.find((project) => project.relationship === "member");

  return (
    <AppShell
      title={`Hi, ${profile.fullName.split(" ")[0]}`}
      subtitle={`${profile.programme} · ${profile.academicYear} · ${profile.department}`}
    >
      <div className="space-y-6">
        <DashboardHeader
          projectCount={data.projects.length}
          invitationCount={data.invitations.length}
          hasUpcomingBooking={Boolean(data.upcoming)}
        />
        <NextActionCard data={data} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-6">
            <JourneyProgress project={journeyProject} hasUpcomingBooking={Boolean(data.upcoming)} />
            <UpcomingBookingCard
              bookings={data.upcomingBookings}
              project={upcomingProject}
              equipment={equipment}
            />
          </div>
          <div className="space-y-6">
            <ProjectsSummary data={data} />
            <InvitationsDrawer invitations={data.invitations} />
          </div>
        </div>

        <ProjectFocus
          projects={data.projects.filter((project) => project.relationship !== "invited")}
        />
        <QuickActions data={data} />
      </div>
    </AppShell>
  );
}

function DashboardHeader({
  projectCount,
  invitationCount,
  hasUpcomingBooking,
}: {
  projectCount: number;
  invitationCount: number;
  hasUpcomingBooking: boolean;
}) {
  const summary = hasUpcomingBooking
    ? "Your next MakerSpace session is ready to review."
    : invitationCount
      ? "You have a team invitation waiting for you."
      : projectCount
        ? "Keep your projects moving toward MakerSpace time."
        : "Start with a project, then bring your team and ideas to MakerSpace.";

  return (
    <section aria-label="Dashboard overview">
      <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
    </section>
  );
}

function NextActionCard({ data }: { data: DashboardData }) {
  if (data.upcoming) {
    const project = data.projects.find((item) => item.id === data.upcoming?.projectId);
    const canManage = project?.relationship === "leader";
    return (
      <ActionCard
        eyebrow="Upcoming MakerSpace visit"
        title={data.upcoming.projectName}
        body={`${data.upcoming.date} · ${data.upcoming.slot}`}
        to="/book"
        action={canManage ? "Manage booking" : "View booking"}
        icon={CalendarCheck}
      />
    );
  }

  if (data.invitations.length) {
    const invitation = data.invitations[0]!;
    return (
      <ActionCard
        eyebrow="Team invitation waiting"
        title={`Join ${invitation.name}`}
        body={`Invited by ${invitation.leader}. Review the project and respond when ready.`}
        to="/invitations/$projectId"
        params={{ projectId: invitation.id }}
        action="Review invitation"
        icon={Users}
      />
    );
  }

  if (data.projects.length === 0) {
    return (
      <ActionCard
        eyebrow="Start building"
        title="Start your first MakerSpace project"
        body="Create a project, invite your team and choose a Faculty Mentor before reserving MakerSpace time."
        to="/projects"
        action="Create Project"
        icon={Plus}
      />
    );
  }

  const rejectedLeaderProject = data.leaderProjects.find(
    (project) => project.status === "Rejected",
  );
  if (rejectedLeaderProject) {
    return (
      <ActionCard
        eyebrow="Project needs attention"
        title={`${rejectedLeaderProject.name} needs revision`}
        body={
          rejectedLeaderProject.rejectionReason ??
          "Review your Faculty Mentor's feedback before updating the project."
        }
        to="/projects/$projectId"
        params={{ projectId: rejectedLeaderProject.id }}
        action="Review feedback"
        icon={CircleAlert}
      />
    );
  }

  const verifiedLeaderProject = data.leaderProjects.find(
    (project) => project.status === "Verified",
  );
  if (verifiedLeaderProject) {
    return (
      <ActionCard
        eyebrow="Ready to book"
        title={`${verifiedLeaderProject.name} is verified`}
        body="Choose your attending team members, then select a MakerSpace slot."
        to="/book"
        action="Book a Slot"
        icon={CalendarClock}
      />
    );
  }

  const pendingProject = data.leaderProjects.find(
    (project) =>
      project.status === "Team Acceptance Pending" || project.status === "Mentor Approval Pending",
  );
  if (pendingProject) {
    const waitingForMentor = pendingProject.status === "Mentor Approval Pending";
    return (
      <ActionCard
        eyebrow="Project verification"
        title={
          waitingForMentor
            ? "Waiting for your Faculty Mentor to approve"
            : "Waiting for your team to accept"
        }
        body={`${pendingProject.name} will be ready to book once verification is complete.`}
        to="/projects/$projectId"
        params={{ projectId: pendingProject.id }}
        action="View project"
        icon={Clock3}
      />
    );
  }

  return (
    <ActionCard
      eyebrow="Your project"
      title="Continue shaping your project"
      body="Review your project details, team and MakerSpace resource requirements."
      to="/projects"
      action="View projects"
      icon={FolderKanban}
    />
  );
}

function ActionCard({
  eyebrow,
  title,
  body,
  to,
  params,
  action,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  to: "/projects" | "/book" | "/invitations/$projectId" | "/projects/$projectId";
  params?: { projectId: string };
  action: string;
  icon: typeof CalendarCheck;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-foreground/80">
            <Icon className="size-4" />
            {eyebrow}
          </span>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/80">{body}</p>
        </div>
        <Link
          to={to}
          params={params ?? {}}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-card/90"
        >
          {action} <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function JourneyProgress({
  project,
  hasUpcomingBooking,
}: {
  project: DashboardProject | undefined;
  hasUpcomingBooking: boolean;
}) {
  const currentStep = hasUpcomingBooking ? 3 : project?.status === "Verified" ? 2 : project ? 1 : 0;

  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Your MakerSpace journey</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {project
              ? `${project.name} · ${project.relationship === "leader" ? "You lead this project" : "Team project"}`
              : "Your next steps will appear here."}
          </p>
        </div>
        {project && <StatusBadge label={project.status} />}
      </div>
      <ol className="mt-5 grid gap-4 sm:grid-cols-4">
        {steps.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <li key={step} className="flex items-center gap-3 sm:block">
              <div className="flex items-center gap-2 sm:w-full">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold",
                    done && "border-success bg-success text-success-foreground",
                    active && "border-primary bg-primary text-primary-foreground",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden h-1 flex-1 rounded-full sm:block",
                    done ? "bg-success" : "bg-border",
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-sm font-medium sm:mt-3",
                  active || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function UpcomingBookingCard({
  bookings,
  project,
  equipment,
}: {
  bookings: Reservation[];
  project: DashboardProject | undefined;
  equipment: Equipment[];
}) {
  const booking = bookings[0];
  if (!booking) {
    return (
      <section>
        <h2 className="mb-3 text-base font-semibold">Upcoming booking</h2>
        <article className="card-surface p-6 text-center">
          <CalendarClock className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No upcoming MakerSpace booking yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bookings become available once a project you lead is verified.
          </p>
        </article>
      </section>
    );
  }

  const attendeeNames = resolveAttendees(booking, project);
  const resourceHealth = booking.resources.map((resource) => ({
    resource,
    status: findEquipmentStatus(resource, equipment),
  }));
  const canManage = project?.relationship === "leader";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Upcoming booking</h2>
        <StatusBadge label={booking.status} />
      </div>
      <article className="card-surface p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{booking.projectName}</h3>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" /> {booking.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" /> {booking.slot}
              </span>
            </p>
          </div>
          <Link
            to="/book"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-accent"
          >
            {canManage ? "Manage booking" : "View booking"}
          </Link>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-muted-foreground" /> Attending team
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {attendeeNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <p className="text-sm font-semibold">Project resource health</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resourceHealth.map(({ resource, status }) => (
              <span
                key={resource}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
              >
                {resource}
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status === "Available"
                      ? "bg-success"
                      : status === "Configured"
                        ? "bg-muted-foreground"
                        : "bg-warning",
                  )}
                />
                <span className="text-muted-foreground">{status}</span>
              </span>
            ))}
          </div>
        </div>
        {bookings.length > 1 && (
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-semibold">More upcoming visits</p>
            <div className="mt-3 space-y-2">
              {bookings.slice(1, 4).map((nextBooking) => (
                <Link
                  key={nextBooking.id}
                  to="/book"
                  className="flex items-center justify-between gap-3 rounded-xl bg-accent/65 px-3 py-3 text-sm hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{nextBooking.projectName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {nextBooking.date} · {nextBooking.slot}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

function ProjectsSummary({ data }: { data: DashboardData }) {
  const summaries = [
    {
      label: "Active projects",
      value: data.projects.filter(
        (project) => project.relationship !== "invited" && project.status !== "Archived",
      ).length,
    },
    {
      label: "Pending verification",
      value: data.projects.filter(
        (project) =>
          project.relationship !== "invited" &&
          (project.status === "Team Acceptance Pending" ||
            project.status === "Mentor Approval Pending"),
      ).length,
    },
    {
      label: "Invites awaiting response",
      value: data.invitations.length + data.leaderPendingInvitations,
    },
  ];
  return (
    <section className="card-surface p-5">
      <h2 className="text-base font-semibold">Project summary</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {summaries.map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-accent/65 p-3">
            <dt className="text-[11px] font-medium leading-4 text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InvitationsDrawer({ invitations }: { invitations: DashboardProject[] }) {
  if (!invitations.length) return null;
  return (
    <section className="card-surface border-warning/30 p-5" aria-label="Project invitations">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
          <CircleAlert className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Team invitations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Respond to join a project team.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {invitations.slice(0, 2).map((project) => (
          <div key={project.id} className="rounded-xl border border-border p-3">
            <p className="truncate text-sm font-semibold">{project.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Team Leader: {project.leader}</p>
            <Link
              to="/invitations/$projectId"
              params={{ projectId: project.id }}
              className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline"
            >
              Review invitation <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectFocus({ projects }: { projects: DashboardProject[] }) {
  if (!projects.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Your projects</h2>
        <Link to="/projects" className="text-sm font-semibold text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {projects.slice(0, 4).map((project) => (
          <article key={project.id} className="card-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{project.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {project.relationship === "leader"
                    ? "You are the Team Leader"
                    : `Team Leader: ${project.leader}`}
                </p>
              </div>
              <StatusBadge label={project.status} />
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" /> {project.members.length + 1} team members
            </p>
            <InvitationProgress project={project} />
            {project.status === "Rejected" && project.rejectionReason && (
              <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm leading-5 text-warning-foreground">
                <span className="font-semibold">Faculty feedback: </span>
                {project.rejectionReason}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="truncate text-xs text-muted-foreground">
                Mentor: {project.mentor}
              </span>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="shrink-0 text-sm font-semibold text-primary hover:underline"
              >
                View project
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function QuickActions({ data }: { data: DashboardData }) {
  const actions = [
    { to: "/projects" as const, label: "Create Project", icon: Plus, visible: true },
    {
      to: "/book" as const,
      label: "Book a Slot",
      icon: CalendarClock,
      visible: data.leaderProjects.some((project) => project.status === "Verified"),
    },
    { to: "/visits" as const, label: "Quick Visit", icon: Footprints, visible: true },
    { to: "/equipment" as const, label: "Explore Equipment", icon: Boxes, visible: true },
  ];
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions
          .filter((action) => action.visible)
          .map(({ to, label, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className="card-surface flex min-h-28 flex-col justify-between p-4 transition-shadow hover:shadow-lg"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <span className="mt-3 text-sm font-semibold">{label}</span>
            </Link>
          ))}
      </div>
    </section>
  );
}

type DashboardData = {
  projects: DashboardProject[];
  leaderProjects: DashboardProject[];
  invitations: DashboardProject[];
  upcoming: Reservation | undefined;
  upcomingBookings: Reservation[];
  leaderPendingInvitations: number;
};

function getDashboardData(
  profile: StudentProfile,
  projects: Project[],
  reservations: Reservation[],
): DashboardData {
  const projectWithRelationship = projects.flatMap((project) => {
    const isLeader = project.leader.toLowerCase() === profile.fullName.toLowerCase();
    const isMember = project.members.some(
      (member) => member.email?.toLowerCase() === profile.email.toLowerCase(),
    );
    const isInvited = project.invitedEmails.some(
      (email) => email.toLowerCase() === profile.email.toLowerCase(),
    );
    if (!isLeader && !isMember && !isInvited) return [];
    return [
      {
        ...project,
        relationship: (isLeader
          ? "leader"
          : isMember
            ? "member"
            : "invited") as ProjectRelationship,
      },
    ];
  });
  const leaderProjects = projectWithRelationship.filter(
    (project) => project.relationship === "leader",
  );
  const projectIds = new Set(
    projectWithRelationship
      .filter((project) => project.relationship !== "invited")
      .map((project) => project.id),
  );
  const upcomingBookings = [...reservations]
    .filter(
      (reservation) => reservation.status === "Active" && projectIds.has(reservation.projectId),
    )
    .sort((a, b) => bookingDay(a.date) - bookingDay(b.date));
  return {
    projects: projectWithRelationship,
    leaderProjects,
    invitations: projectWithRelationship.filter((project) => project.relationship === "invited"),
    upcoming: upcomingBookings[0],
    upcomingBookings,
    leaderPendingInvitations: leaderProjects.reduce(
      (count, project) =>
        count +
        getTeamInvitations(project).filter((invitation) => invitation.status === "Pending").length,
      0,
    ),
  };
}

function InvitationProgress({ project }: { project: DashboardProject }) {
  if (project.relationship !== "leader") return null;
  const invitations = getTeamInvitations(project);
  if (!invitations.length) return null;
  const counts = invitations.reduce<Record<string, number>>((result, invitation) => {
    result[invitation.status] = (result[invitation.status] ?? 0) + 1;
    return result;
  }, {});
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs font-semibold text-muted-foreground">Team invitations</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(counts).map(([status, count]) => (
          <span
            key={status}
            className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
          >
            {count} {status.toLowerCase()}
          </span>
        ))}
      </div>
      {invitations.some((invitation) => invitation.status === "Pending") && (
        <p className="mt-2 text-xs text-muted-foreground">
          Waiting for invited team members to respond.
        </p>
      )}
    </div>
  );
}

function getTeamInvitations(project: DashboardProject) {
  return (
    project.teamInvitations ??
    project.invitedEmails.map((email) => ({ email, name: email, status: "Pending" as const }))
  );
}

function bookingDay(date: string) {
  return Number(date.match(/\b(\d{1,2})\b/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function resolveAttendees(booking: Reservation, project: DashboardProject | undefined) {
  if (!project) return [`${booking.attendees} team members attending`];
  const names = booking.participantIds.map((id) => {
    if (id === "leader") return project.leader;
    return project.members.find((member) => member.id === id)?.name ?? "Team member";
  });
  return [...new Set(names)];
}

function findEquipmentStatus(resource: string, equipment: Equipment[]) {
  const key = resource.toLowerCase();
  const match = equipment.find((item) => {
    const name = item.name.toLowerCase();
    return (
      name.includes(key) ||
      (key.includes("robot") && item.category === "Robotics") ||
      (key.includes("workstation") && item.category === "Workstations") ||
      ((key.includes("solder") || key.includes("oscilloscope")) && item.category === "Electronics")
    );
  });
  return match?.status ?? "Configured";
}
