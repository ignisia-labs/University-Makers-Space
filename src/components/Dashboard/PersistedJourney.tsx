import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { BookingSummaryCard } from "@/components/Booking/BookingSummaryCard";
import { visitsApi, type BookingDto, type ProjectSummary } from "@/lib/api";
import { projectStatusLabel } from "@/lib/project-queries";
import { cn } from "@/lib/utils";

/**
 * The student journey: create a project, book a slot, visit.
 *
 * Only a VERIFIED project unlocks booking. A teammate who has not yet accepted
 * does not hold that up — the mentor's decision verifies the project, and the
 * unanswered teammate is simply absent from the attendee list when the slot is
 * booked.
 */
export function PersistedJourney({
  projects,
  upcoming,
  loading,
}: {
  projects: ProjectSummary[];
  upcoming: BookingDto | undefined;
  loading: boolean;
}) {
  const mine = useMemo(
    () => projects.filter((project) => project.status !== "ARCHIVED"),
    [projects],
  );

  // A live booking pins the project; otherwise the student chooses.
  const lockedId = upcoming?.projectId ?? null;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selectedId =
    lockedId ?? (mine.some((project) => project.id === pickedId) ? pickedId : null);
  const selected = mine.find((project) => project.id === selectedId) ?? mine[0];

  useEffect(() => {
    // Prefer a verified project: it is the only kind that can move the journey
    // forward, so defaulting to one saves a click in the common case.
    if (pickedId || lockedId || !mine.length) return;
    const preferred = mine.find((project) => project.status === "VERIFIED") ?? mine[0];
    if (preferred) setPickedId(preferred.id);
  }, [pickedId, lockedId, mine]);

  const step = upcoming ? 2 : selected?.status === "VERIFIED" ? 1 : 0;

  return (
    <section aria-label="Your MakerSpace journey" className="mt-10 sm:mt-12">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Your journey</p>

      <ol className="relative mt-6 space-y-10 border-l border-border pl-8 sm:space-y-12 sm:pl-12">
        <JourneyStep index={0} current={step} title="Create your project" done={step > 0}>
          <CreateChapter
            projects={mine}
            selectedId={selected?.id}
            locked={Boolean(lockedId)}
            loading={loading}
            onSelect={setPickedId}
          />
        </JourneyStep>

        <JourneyStep index={1} current={step} title="Book your slot" done={step > 1}>
          <BookChapter selected={selected} hasBooking={Boolean(upcoming)} />
        </JourneyStep>

        <JourneyStep index={2} current={step} title="Visit the MakerSpace" done={false}>
          <VisitChapter upcoming={upcoming} />
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

/** How the viewer relates to the project. "Member" is not a safe default: a
 *  mentor or an operator with oversight is neither the lead nor on the team. */
function relationshipLabel(project: ProjectSummary) {
  switch (project.viewerRelationship) {
    case "LEADER":
      return "Lead";
    case "MEMBER":
      return "Member";
    case "MENTOR":
      return "Mentor";
    default:
      return "Oversight";
  }
}

function ProjectPickerRow({
  project,
  selected,
  locked,
  onSelect,
}: {
  project: ProjectSummary;
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
        "flex min-h-14 w-full items-center gap-3.5 px-5 py-3 text-left transition-colors",
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
        <span className="block truncate text-sm font-medium">{project.title}</span>
        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {relationshipLabel(project)} · {projectStatusLabel(project.status)}
        </span>
      </span>
    </button>
  );
}

function CreateChapter({
  projects,
  selectedId,
  locked,
  loading,
  onSelect,
}: {
  projects: ProjectSummary[];
  selectedId: string | undefined;
  locked: boolean;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const [allOpen, setAllOpen] = useState(false);

  if (loading) return <div className="card-surface h-28 animate-pulse bg-muted/40" />;

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

  // Keep the selected project visible even when it is not one of the two most recent.
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
                <span className="block truncate text-sm font-medium">{project.title}</span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {relationshipLabel(project)}
                </span>
              </span>
              <StatusBadge label={projectStatusLabel(project.status)} />
            </button>
          ))}
        </div>
      </ResponsiveModal>
    </div>
  );
}

function BookChapter({
  selected,
  hasBooking,
}: {
  selected: ProjectSummary | undefined;
  hasBooking: boolean;
}) {
  if (hasBooking) {
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
  if (selected.status === "VERIFIED") {
    // Only the Team Leader may reserve capacity for a project.
    const canBook = selected.viewerRelationship === "LEADER";
    return (
      <div className="card-surface p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">{selected.title}</span> is verified.{" "}
          {canBook
            ? "Choose a date and time for your team."
            : "Your Team Leader books the slot for this project."}
        </p>
        {canBook && (
          <Link
            to="/book"
            search={{ project: selected.id }}
            className="pressable mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Book a slot <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    );
  }
  return (
    <p className="text-sm leading-6 text-muted-foreground">
      {selected.status === "REJECTED"
        ? `${selected.title} needs changes before it can be booked.`
        : `Waiting for your mentor to verify ${selected.title} — booking unlocks right after.`}
    </p>
  );
}

function VisitChapter({ upcoming }: { upcoming: BookingDto | undefined }) {
  if (!upcoming) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Your session details will appear here.
      </p>
    );
  }
  return <BookingSummaryCard booking={upcoming} />;
}

/**
 * Lab time and visit count.
 *
 * Derived from closed visits only — a session still in progress has no duration
 * yet, and counting it would make the figure drift upward while somebody is
 * simply still in the room.
 */
export function useVisitStats() {
  const visits = useQuery({
    queryKey: ["visits", "self", "stats"],
    queryFn: () => visitsApi.list({ limit: "100" }).then((r) => r.data),
    staleTime: 60_000,
  });
  const closed = (visits.data ?? []).filter((visit) => visit.status === "CHECKED_OUT");
  const minutes = closed.reduce((total, visit) => total + (visit.durationMinutes ?? 0), 0);
  return { visits: closed.length, minutes };
}

export function formatMinutes(total: number) {
  if (!total) return "0h";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
