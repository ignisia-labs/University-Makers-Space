import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { IgnisiaCredit } from "@/components/IgnisiaCredit";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import type { Project, Reservation, StudentProfile } from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MIT-WPU MakerSpace" },
      {
        name: "description",
        content: "Your MakerSpace journey — create a project, book a slot, build.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, projects, reservations, visits } = useMakerSpace();
  const data = useMemo(
    () => getJourneyData(profile, projects, reservations),
    [profile, projects, reservations],
  );
  const studentVisits = visits.filter(
    (visit) => visit.ownerEmail?.toLowerCase() === profile.email.toLowerCase(),
  );
  const completedVisits = studentVisits.filter((visit) => visit.status === "Completed");
  const labMinutes = completedVisits.reduce(
    (total, visit) => total + visitMinutes(visit.entry, visit.exit),
    0,
  );

  // While a session is live the booked project is locked in; otherwise the student picks one.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const lockedId = data.upcoming?.projectId ?? null;
  const selectedId = lockedId ?? (data.myProjects.some((p) => p.id === pickedId) ? pickedId : null);
  const selected =
    data.myProjects.find((project) => project.id === selectedId) ?? data.myProjects[0];

  useEffect(() => {
    if (!pickedId && !lockedId && data.myProjects[0]) setPickedId(data.myProjects[0].id);
  }, [pickedId, lockedId, data.myProjects]);

  const firstName = profile.fullName.trim().split(" ")[0] || "there";

  return (
    <AppShell title={`Hi, ${firstName}`} subtitle={profile.department}>
      <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-3xl duration-500">
        <StatStrip
          projects={data.myProjects.length}
          labTime={formatMinutes(labMinutes)}
          visits={completedVisits.length}
        />

        <Journey
          data={data}
          selected={selected}
          locked={Boolean(lockedId)}
          onSelect={setPickedId}
        />

        <div className="mt-14 flex justify-center border-t border-border pt-8">
          <IgnisiaCredit />
        </div>
      </div>
    </AppShell>
  );
}

function StatStrip({
  projects,
  labTime,
  visits,
}: {
  projects: number;
  labTime: string;
  visits: number;
}) {
  const stats = [
    { label: "Projects", value: String(projects) },
    { label: "Lab time", value: labTime },
    { label: "Visits", value: String(visits) },
  ];
  return (
    <section
      aria-label="Your progress"
      className="card-surface flex items-stretch divide-x divide-border px-2 py-4"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex-1 px-3 text-center sm:px-6">
          <p className="font-serif text-2xl font-light text-foreground sm:text-3xl">{stat.value}</p>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {stat.label}
          </p>
        </div>
      ))}
    </section>
  );
}

/* ── The journey ──────────────────────────────────────────────── */

function Journey({
  data,
  selected,
  locked,
  onSelect,
}: {
  data: JourneyData;
  selected: MyProject | undefined;
  locked: boolean;
  onSelect: (id: string) => void;
}) {
  const step = data.upcoming ? 2 : selected?.status === "Verified" ? 1 : 0;

  return (
    <section aria-label="Your MakerSpace journey" className="mt-10 sm:mt-12">
      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Your journey</p>

      <ol className="relative mt-6 space-y-10 border-l border-border pl-8 sm:space-y-12 sm:pl-12">
        <JourneyStep index={0} current={step} title="Create your project" done={step > 0}>
          <CreateChapter
            projects={data.myProjects}
            selectedId={selected?.id}
            locked={locked}
            onSelect={onSelect}
          />
        </JourneyStep>

        <JourneyStep index={1} current={step} title="Book your slot" done={step > 1}>
          <BookChapter data={data} selected={selected} />
        </JourneyStep>

        <JourneyStep index={2} current={step} title="Visit the MakerSpace" done={false}>
          <VisitChapter upcoming={data.upcoming} />
        </JourneyStep>
      </ol>
    </section>
  );
}

function JourneyStep({
  index,
  current,
  title,
  done,
  children,
}: {
  index: number;
  current: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  const active = index === current;
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[calc(2rem+13px)] top-0 grid size-[26px] place-items-center rounded-full border bg-background font-mono text-[11px] transition-colors sm:-left-[calc(3rem+13px)]",
          done && "border-primary bg-primary text-primary-foreground",
          active &&
            "border-primary text-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_12%,transparent)]",
          !done && !active && "border-border text-muted-foreground",
        )}
        aria-hidden
      >
        {done ? <Check className="size-3.5 stroke-[3]" /> : `0${index + 1}`}
      </span>
      <h2
        className={cn(
          "font-serif text-xl font-light tracking-wide sm:text-2xl",
          active || done ? "text-foreground" : "text-muted-foreground/70",
        )}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </li>
  );
}

function ProjectPickerRow({
  project,
  selected,
  locked,
  onSelect,
}: {
  project: MyProject;
  selected: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      aria-pressed={selected}
      onClick={() => onSelect(project.id)}
      className={cn(
        "flex w-full min-h-14 items-center gap-3.5 px-5 py-3 text-left transition-colors",
        selected ? "bg-primary/[0.06]" : "hover:bg-secondary/60",
        locked && "cursor-default",
      )}
    >
      <span
        className={cn(
          "grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
        aria-hidden
      >
        {selected && <Check className="size-2.5 stroke-[3]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{project.name}</span>
        <span className="mt-0.5 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {project.relationship === "leader" ? "Lead" : "Member"} · {project.status}
        </span>
      </span>
    </button>
  );
}

function CreateChapter({
  projects,
  selectedId,
  locked,
  onSelect,
}: {
  projects: MyProject[];
  selectedId: string | undefined;
  locked: boolean;
  onSelect: (id: string) => void;
}) {
  const [allOpen, setAllOpen] = useState(false);

  if (!projects.length) {
    return (
      <div className="card-surface p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Every build starts here. Name it, bring your team, pick a mentor.
        </p>
        <Link
          to="/projects"
          search={{ create: true }}
          className="pressable mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> Create project
        </Link>
      </div>
    );
  }

  // Keep the selected project visible even when it isn't one of the two most recent.
  const visible = projects.slice(0, 2);
  if (selectedId && !visible.some((project) => project.id === selectedId)) {
    const selectedProject = projects.find((project) => project.id === selectedId);
    if (selectedProject) visible.splice(1, 1, selectedProject);
  }

  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {visible.map((project) => (
        <ProjectPickerRow
          key={project.id}
          project={project}
          selected={project.id === selectedId}
          locked={locked}
          onSelect={onSelect}
        />
      ))}
      <div className="flex items-center divide-x divide-border">
        <Link
          to="/projects"
          search={{ create: true }}
          className="flex min-h-12 flex-1 items-center gap-2 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary/60"
        >
          <Plus className="size-4" /> Create another
        </Link>
        {projects.length > 2 && (
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            className="min-h-12 shrink-0 px-5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            View all ({projects.length})
          </button>
        )}
      </div>

      <ResponsiveModal
        open={allOpen}
        onOpenChange={setAllOpen}
        title="All projects"
        description={
          locked
            ? "Cancel your booked session to switch projects."
            : "Pick the project you want to work with."
        }
      >
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              disabled={locked}
              onClick={() => {
                onSelect(project.id);
                setAllOpen(false);
              }}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                project.id === selectedId ? "bg-primary/[0.06]" : "hover:bg-secondary/60",
                locked && "cursor-default",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{project.name}</span>
                <span className="mt-0.5 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {project.relationship === "leader" ? "Lead" : "Member"}
                </span>
              </span>
              <StatusBadge label={project.status} />
            </button>
          ))}
        </div>
      </ResponsiveModal>
    </div>
  );
}

function BookChapter({ data, selected }: { data: JourneyData; selected: MyProject | undefined }) {
  if (data.upcoming) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Slot reserved — see your session below.
      </p>
    );
  }
  if (!selected) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">Unlocks after you create a project.</p>
    );
  }
  if (selected.status === "Verified") {
    return (
      <div className="card-surface p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">{selected.name}</span> is verified. Choose a
          date and time for your team.
        </p>
        <Link
          to="/book"
          search={{ project: selected.id }}
          className="pressable mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Book a slot <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }
  return (
    <p className="text-sm leading-6 text-muted-foreground">
      {selected.status === "Team Acceptance Pending"
        ? `Waiting for your teammates to accept their invitations for ${selected.name}.`
        : selected.status === "Rejected"
          ? `${selected.name} needs changes before it can be booked.`
          : `Waiting for your mentor to verify ${selected.name} — booking unlocks right after.`}
    </p>
  );
}

function VisitChapter({ upcoming }: { upcoming: Reservation | undefined }) {
  if (!upcoming) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Your session details will appear here.
      </p>
    );
  }
  return (
    <Link to="/book" className="card-surface group block p-5 transition-shadow hover:shadow-md">
      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
        Upcoming session
      </p>
      <p className="mt-2 font-serif text-lg font-light text-foreground sm:text-xl">
        {upcoming.projectName}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
        <span>{upcoming.date}</span>
        <span aria-hidden>·</span>
        <span>{upcoming.slot}</span>
        <span aria-hidden>·</span>
        <span>{upcoming.attendees} attending</span>
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        View session
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/* ── Data ─────────────────────────────────────────────────────── */

type MyProject = Project & { relationship: "leader" | "member" };

type JourneyData = {
  myProjects: MyProject[];
  upcoming: Reservation | undefined;
};

function getJourneyData(
  profile: StudentProfile,
  projects: Project[],
  reservations: Reservation[],
): JourneyData {
  const myProjects = projects.flatMap<MyProject>((project) => {
    const isLeader =
      Boolean(profile.fullName) && project.leader.toLowerCase() === profile.fullName.toLowerCase();
    const isMember = project.members.some(
      (member) => member.email?.toLowerCase() === profile.email.toLowerCase(),
    );
    if (!isLeader && !isMember) return [];
    if (project.status === "Archived") return [];
    return [{ ...project, relationship: isLeader ? "leader" : "member" }];
  });
  const projectIds = new Set(myProjects.map((project) => project.id));
  const upcoming = [...reservations]
    .filter((r) => r.status === "Active" && projectIds.has(r.projectId))
    .sort((a, b) => bookingDay(a.date) - bookingDay(b.date))[0];
  return { myProjects, upcoming };
}

function bookingDay(date: string) {
  return Number(date.match(/\b(\d{1,2})\b/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function visitMinutes(entry: string, exit: string | null) {
  if (!exit) return 0;
  const [entryHour = 0, entryMinute = 0] = entry.split(":").map(Number);
  const [exitHour = 0, exitMinute = 0] = exit.split(":").map(Number);
  return Math.max(0, exitHour * 60 + exitMinute - (entryHour * 60 + entryMinute));
}

function formatMinutes(total: number) {
  if (!total) return "0h";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
