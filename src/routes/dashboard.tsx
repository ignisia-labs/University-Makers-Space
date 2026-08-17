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
        <h2
          id="student-metrics-title"
          className="text-xs font-mono uppercase tracking-widest text-[#1E2B8A]"
        >
          At a glance
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          Your current progress
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, note, to, icon: Icon, tone, status }) => (
          <Link
            key={label}
            to={to}
            className="card-surface group flex min-h-40 min-w-0 flex-col justify-between p-4 border border-indigo-100 bg-white shadow-sm rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-indigo-100/80 hover:border-indigo-300/60 sm:min-h-44 sm:p-5 relative overflow-hidden"
          >
            {/* Ambient inner shadow highlight */}
            <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#F0EFFF]/30 to-[#F0EFFF]/60 pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  metricToneClass(tone),
                )}
              >
                <Icon className="size-4.5" />
              </span>
              {status && <StatusBadge label={status} className="shrink-0" />}
            </div>

            <div className="relative z-10 min-w-0 pt-3">
              <p className="text-[9px] font-mono tracking-widest uppercase text-zinc-400 font-semibold">
                {label}
              </p>
              <p className="mt-1.5 truncate text-base font-serif font-light text-zinc-800 sm:text-xl">
                {value}
              </p>

              {/* Custom sparkline telemetry graph for MakerSpace Time */}
              {label === "MakerSpace time" && (
                <div className="mt-3 w-full h-8 flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 20">
                    <path
                      d="M 0 18 Q 15 5, 30 14 T 60 4 T 90 12 T 100 2"
                      fill="none"
                      stroke="#1E2B8A"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0 18 Q 15 5, 30 14 T 60 4 T 90 12 T 100 2 L 100 20 L 0 20 Z"
                      fill="url(#sparkline-grad)"
                      opacity="0.08"
                    />
                    <defs>
                      <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1E2B8A" />
                        <stop offset="100%" stopColor="#1E2B8A" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}

              {/* Custom horizontal copper progress bar for Project Readiness */}
              {label === "Project readiness" && (
                <div className="mt-3 w-full">
                  <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1E2B8A] rounded-full transition-all duration-1000"
                      style={{
                        width:
                          value === "Ready to reserve" || value === "Team verified"
                            ? "100%"
                            : value === "Verification pending"
                              ? "60%"
                              : "20%",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Custom dot array visualizer for Active Projects */}
              {label === "Active projects" && (
                <div className="mt-3.5 flex gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-2 h-1 rounded-full transition-colors duration-500",
                        i < activeProjects ? "bg-[#2CC5B0]" : "bg-zinc-200",
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Custom active timeline indicator for Upcoming Slot */}
              {label === "Upcoming slot" && (
                <div className="mt-3.5 flex items-center gap-1.5 font-mono text-[9px] text-[#1E2B8A] uppercase tracking-wider">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      nextSlot ? "bg-[#2CC5B0] animate-pulse" : "bg-zinc-300",
                    )}
                  />
                  <span>{nextSlot ? "Active reservation" : "Idle state"}</span>
                </div>
              )}

              <p className="mt-2 line-clamp-1 text-[10px] leading-4 text-zinc-400 font-mono tracking-tight">
                {note}
              </p>
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
    <section className="card-surface p-6 border border-indigo-100 bg-white shadow-sm shadow-indigo-50/50 rounded-3xl relative overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#1E2B8A]">
            Your MakerSpace journey
          </h2>
          <p className="mt-1.5 text-sm font-serif font-light italic text-zinc-500">
            {project
              ? `${project.name} · ${project.relationship === "leader" ? "Project Lead" : "Team Member"}`
              : "Your next steps will appear here."}
          </p>
        </div>
        {project && <StatusBadge label={project.status} />}
      </div>

      <div className="relative mt-8">
        {/* Background connector line */}
        <div className="absolute top-[18px] left-4 right-4 h-0.5 bg-zinc-100 -z-10 hidden sm:block" />

        <ol className="grid gap-6 sm:grid-cols-4 relative z-10">
          {steps.map((step, index) => {
            const done = index < currentStep;
            const active = index === currentStep;
            return (
              <li key={step} className="flex items-center gap-4 sm:block sm:text-center">
                <div className="flex items-center justify-center gap-2 sm:w-full relative">
                  {/* Step Node */}
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full border text-xs font-mono transition-all duration-500",
                      done &&
                        "border-[#2CC5B0] bg-[#2CC5B0] text-white shadow-sm shadow-[#2CC5B0]/10",
                      active &&
                        "border-[#1E2B8A] bg-[#1E2B8A] text-white shadow-md shadow-[#1E2B8A]/15 scale-110",
                      !done && !active && "border-zinc-200 bg-white text-zinc-400",
                    )}
                  >
                    {done ? <Check className="size-4 stroke-[2.5]" /> : `0${index + 1}`}
                  </span>
                </div>

                {/* Step Label */}
                <div className="sm:mt-3">
                  <p
                    className={cn(
                      "text-[10px] font-mono tracking-widest uppercase font-semibold transition-colors duration-500",
                      active ? "text-[#1E2B8A]" : done ? "text-zinc-700" : "text-zinc-400",
                    )}
                  >
                    {step}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const NoBookingBlueprint = () => (
  <svg
    className="w-full max-w-[130px] h-24 opacity-25 select-none text-[#1E2B8A] hidden sm:block"
    viewBox="0 0 100 80"
    fill="none"
  >
    <g stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5 1.5">
      <path d="M 10 10 L 90 10 L 90 70 L 10 70 Z" />
      <path d="M 10 30 L 90 30" />
      <path d="M 10 50 L 90 50" />
      <path d="M 30 10 L 30 70" />
      <path d="M 50 10 L 50 70" />
      <path d="M 70 10 L 70 70" />
    </g>
    <path
      d="M 10 10 L 25 25 M 90 10 L 75 25 M 90 70 L 75 55 M 10 70 L 25 55"
      stroke="currentColor"
      strokeWidth="0.5"
    />
    <circle cx="50" cy="40" r="14" stroke="currentColor" strokeWidth="0.75" />
    <circle cx="50" cy="40" r="4" fill="currentColor" />
    <path d="M 50 20 L 50 60 M 30 40 L 70 40" stroke="currentColor" strokeWidth="0.5" />
  </svg>
);

const MachineBlueprint = () => (
  <svg
    className="w-full max-w-[140px] h-28 opacity-80 select-none hidden lg:block text-[#1E2B8A]"
    viewBox="0 0 120 100"
    fill="none"
  >
    {/* Frame */}
    <path d="M 20 80 L 100 80 L 100 20 L 20 20 Z" stroke="#0F172A" strokeWidth="0.75" />
    {/* Dual Z rods */}
    <path
      d="M 30 80 L 30 20 M 90 80 L 90 20"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeDasharray="2 1"
    />
    {/* Platform */}
    <path d="M 25 65 L 95 65" stroke="#0F172A" strokeWidth="1.2" />
    {/* Gantry */}
    <path d="M 20 45 L 100 45" stroke="#0F172A" strokeWidth="1.5" />
    {/* Head */}
    <g transform="translate(52, 38)">
      <rect
        x="0"
        y="0"
        width="16"
        height="11"
        rx="1"
        fill="#F0EFFF"
        stroke="currentColor"
        strokeWidth="0.75"
      />
      <path d="M 5 11 L 8 15 L 11 11 Z" fill="currentColor" />
      <path d="M 8 -10 L 8 0" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.5 1" />
    </g>
    <text
      x="15"
      y="93"
      fill="currentColor"
      fontSize="5"
      fontFamily="monospace"
      letterSpacing="0.05em"
    >
      SYS_FABRICATION_4.0
    </text>
    <text x="80" y="15" fill="zinc-400" fontSize="5" fontFamily="monospace">
      STATUS: OK
    </text>
  </svg>
);

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
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-[#1E2B8A]">
          Upcoming booking / visit
        </h2>
        <article className="card-surface p-6 border border-indigo-100 bg-white shadow-sm shadow-indigo-50/50 rounded-3xl flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-base font-serif font-light text-zinc-800">
              No active laboratory reservation
            </h3>
            <p className="mt-1.5 text-xs text-zinc-400 leading-normal max-w-sm">
              Reservations and slot calendars become active once a project you lead receives mentor
              verification.
            </p>
          </div>
          <NoBookingBlueprint />
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
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#1E2B8A]">
          Upcoming booking / visit
        </h2>
        <StatusBadge label={booking.status} />
      </div>
      <article className="card-surface p-6 border border-indigo-100 bg-white shadow-sm shadow-indigo-50/50 rounded-3xl">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-serif font-medium text-zinc-800 leading-snug">
              {booking.projectName}
            </h3>

            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-[#1E2B8A]" /> {booking.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4 text-[#1E2B8A]" /> {booking.slot}
              </span>
            </p>

            <div className="mt-6 border-t border-indigo-50 pt-5">
              <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                <Users className="size-4 text-[#1E2B8A]" /> Attending team
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {attendeeNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-mono text-indigo-900"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-indigo-50 pt-5">
              <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                Project resource health
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {resourceHealth.map(({ resource, status }) => (
                  <span
                    key={resource}
                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-mono text-indigo-700"
                  >
                    {resource}
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        status === "Available"
                          ? "bg-[#2CC5B0]"
                          : status === "Configured"
                            ? "bg-zinc-400"
                            : "bg-[#1E2B8A]",
                      )}
                    />
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-6 shrink-0">
            <Link
              to="/book"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#1E2B8A] px-4 text-xs font-semibold uppercase tracking-wider text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              {canManage ? "Manage" : "View"}
            </Link>

            <MachineBlueprint />
          </div>
        </div>

        {bookings.length > 1 && (
          <div className="mt-5 border-t border-indigo-50 pt-5">
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              More upcoming visits
            </p>
            <div className="mt-3 space-y-2">
              {bookings.slice(1, 4).map((nextBooking) => (
                <Link
                  key={nextBooking.id}
                  to="/book"
                  className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50/80 border border-indigo-100 px-3 py-3 text-xs hover:bg-[#F0EFFF]/70"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-serif text-sm font-medium text-zinc-800">
                      {nextBooking.projectName}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground font-mono">
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
  const canReserve = data.leaderProjects.some((project) => project.status === "Verified");
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
      label: canReserve ? "Reserve a Slot" : "View Slot Schedule",
      description: canReserve
        ? "Choose a session for a verified project."
        : "Review available sessions and booking requirements.",
      icon: CalendarClock,
      visible: true,
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
  ];
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Quick actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions
          .filter((action) => action.visible)
          .map(({ to, label, description, icon: Icon }) => (
            <Link
              key={label}
              to={to}
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
