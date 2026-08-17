import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
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
  TimerReset,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import type { Equipment, Project, Reservation, StudentProfile, Visit } from "@/lib/makerspace-data";
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
  const { profile, projects, reservations, equipment, visits } = useMakerSpace();
  const studentVisits = visits.filter(
    (visit) => visit.ownerEmail?.toLowerCase() === profile.email.toLowerCase(),
  );
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
        <StudentMetrics data={data} visits={studentVisits} />
        <JourneyProgress project={journeyProject} hasUpcomingBooking={Boolean(data.upcoming)} />
        <NextActionCard data={data} />
        <UpcomingBookingCard
          bookings={data.upcomingBookings}
          project={upcomingProject}
          equipment={equipment}
        />
        <InvitationsDrawer invitations={data.invitations} />

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

  // The dedicated upcoming-booking card is the single source of truth for the next visit.
  if (data.upcoming) return null;

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

function StudentMetrics({ data, visits }: { data: DashboardData; visits: Visit[] }) {
  const activeProjects = data.projects.filter(
    (project) => project.relationship !== "invited" && project.status !== "Archived",
  ).length;
  const completedVisits = visits.filter((visit) => visit.status === "Completed" && visit.exit);
  const totalMinutes = completedVisits.reduce(
    (total, visit) => total + visitDurationMinutes(visit.entry, visit.exit),
    0,
  );
  const verifiedLeaderProject = data.leaderProjects.find(
    (project) => project.status === "Verified",
  );
  const verifiedTeamProject = data.projects.find(
    (project) => project.relationship === "member" && project.status === "Verified",
  );
  const readiness = verifiedLeaderProject
    ? { value: "Ready to reserve", note: verifiedLeaderProject.name, tone: "success" }
    : verifiedTeamProject
      ? { value: "Team verified", note: verifiedTeamProject.name, tone: "success" }
      : activeProjects
        ? {
            value: "Verification pending",
            note: "Complete your current project steps",
            tone: "warning",
          }
        : { value: "Start a project", note: "Create a project to begin", tone: "neutral" };
  const nextSlot = data.upcoming;
  const slotStatus = nextSlot ? relativeBookingDay(nextSlot.date) : "No slot reserved";

  const metrics = [
    {
      label: "Active projects",
      value: String(activeProjects),
      note: activeProjects === 1 ? "Project in progress" : "Projects in progress",
      to: "/projects" as const,
      icon: FolderKanban,
      tone: "primary",
    },
    {
      label: "MakerSpace time",
      value: formatVisitDuration(totalMinutes),
      note: `${completedVisits.length} completed ${completedVisits.length === 1 ? "visit" : "visits"}`,
      to: "/visits" as const,
      icon: TimerReset,
      tone: "info",
    },
    {
      label: "Project readiness",
      value: readiness.value,
      note: readiness.note,
      to: "/projects" as const,
      icon: BadgeCheck,
      tone: readiness.tone,
    },
    {
      label: "Upcoming slot",
      value: slotStatus,
      note: nextSlot ? `${nextSlot.date} · ${nextSlot.slot}` : "Reserve when a project is verified",
      to: "/book" as const,
      icon: CalendarClock,
      tone: nextSlot ? "primary" : "neutral",
      status: nextSlot?.status,
    },
  ];

  return (
    <section aria-labelledby="student-metrics-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="student-metrics-title" className="text-base font-semibold">
          At a glance
        </h2>
        <span className="text-xs font-medium text-muted-foreground">Your current progress</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, note, to, icon: Icon, tone, status }) => (
          <Link
            key={label}
            to={to}
            className="card-surface group flex min-h-36 min-w-0 flex-col justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:min-h-40 sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  metricToneClass(tone),
                )}
              >
                <Icon className="size-5" />
              </span>
              {status && (
                <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                  {status}
                </span>
              )}
            </div>
            <div className="min-w-0 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                {label}
              </p>
              <p className="mt-1 truncate text-base font-bold sm:text-xl">{value}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{note}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
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
        <h2 className="mb-3 text-base font-semibold">Upcoming booking / visit</h2>
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
        <h2 className="text-base font-semibold">Upcoming booking / visit</h2>
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

function QuickActions({ data }: { data: DashboardData }) {
  const actions = [
    {
      to: "/projects" as const,
      label: "Create Project",
      description: "Register a new build and invite your team.",
      icon: Plus,
      visible: true,
    },
    {
      to: "/book" as const,
      label: "Reserve a Slot",
      description: "Choose a session for a verified project.",
      icon: CalendarClock,
      visible: data.leaderProjects.some((project) => project.status === "Verified"),
    },
    {
      to: "/visits" as const,
      label: "Request Quick Visit",
      description: "Ask to visit without a project reservation.",
      icon: Footprints,
      visible: true,
    },
    {
      to: "/equipment" as const,
      label: "Explore Equipment Directory",
      description: "Review available tools and resources.",
      icon: Boxes,
      visible: true,
    },
    {
      to: "/invitations/$projectId" as const,
      params: data.invitations[0] ? { projectId: data.invitations[0].id } : undefined,
      label: "View Pending Invitations",
      description: `${data.invitations.length} ${data.invitations.length === 1 ? "invitation needs" : "invitations need"} your response.`,
      icon: Users,
      visible: data.invitations.length > 0,
    },
  ];
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Quick actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions
          .filter((action) => action.visible)
          .map(({ to, params, label, description, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              params={params ?? {}}
              className="card-surface group flex min-h-36 flex-col justify-between p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mt-5">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
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

function visitDurationMinutes(entry: string, exit: string | null) {
  if (!exit) return 0;
  const [entryHour = 0, entryMinute = 0] = entry.split(":").map(Number);
  const [exitHour = 0, exitMinute = 0] = exit.split(":").map(Number);
  return Math.max(0, exitHour * 60 + exitMinute - (entryHour * 60 + entryMinute));
}

function formatVisitDuration(totalMinutes: number) {
  if (!totalMinutes) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function relativeBookingDay(dateLabel: string) {
  const match = dateLabel.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!match) return "Scheduled";
  const [, day, month] = match;
  const bookingDate = new Date(`${month} ${day}, ${new Date().getFullYear()} 00:00:00`);
  if (Number.isNaN(bookingDate.getTime())) return "Scheduled";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((bookingDate.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return "Scheduled";
}

function metricToneClass(tone: string) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "info") return "bg-info/10 text-info";
  if (tone === "primary") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}
