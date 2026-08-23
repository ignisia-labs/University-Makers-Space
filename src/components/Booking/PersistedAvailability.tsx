import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, ChevronRight, Clock3, Info, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { labsApi, referenceApi } from "@/lib/api";
import { usePersistedProjects } from "@/lib/project-queries";
import { cn } from "@/lib/utils";

export function PersistedAvailability({ preselectedProjectId }: { preselectedProjectId?: string }) {
  const labs = useQuery({
    queryKey: ["reference-labs"],
    queryFn: () => referenceApi.labs().then((response) => response.data),
  });
  const projects = usePersistedProjects();
  const leaderProjects = useMemo(
    () =>
      (projects.data ?? []).filter(
        (project) => project.viewerRelationship === "LEADER" && project.status !== "ARCHIVED",
      ),
    [projects.data],
  );
  const [projectId, setProjectId] = useState(preselectedProjectId ?? "");
  const selectedProject = leaderProjects.find((project) => project.id === projectId);
  const labId = selectedProject?.labId ?? labs.data?.[0]?.id ?? "";
  const participantCount = selectedProject?.memberCount ?? 1;
  const dates = useQuery({
    queryKey: ["availability-dates", labId, projectId, participantCount],
    queryFn: () =>
      labsApi
        .availabilityDates(labId, projectId || undefined, participantCount)
        .then((response) => response.data),
    enabled: Boolean(labId && projectId),
    staleTime: 60_000,
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const availability = useQuery({
    queryKey: ["daily-availability", labId, selectedDate, projectId, participantCount],
    queryFn: () =>
      labsApi
        .dailyAvailability(labId, selectedDate, projectId, participantCount)
        .then((response) => response.data),
    enabled: Boolean(labId && selectedDate && projectId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (leaderProjects.length && !leaderProjects.some((project) => project.id === projectId)) {
      const preferred = leaderProjects.find((project) => project.id === preselectedProjectId);
      setProjectId(preferred?.id ?? leaderProjects[0]!.id);
    }
  }, [leaderProjects, preselectedProjectId, projectId]);
  useEffect(() => {
    const firstOpen = dates.data?.dates.find((date) => date.isOpen && date.canFit);
    if (!selectedDate || !dates.data?.dates.some((date) => date.date === selectedDate)) {
      setSelectedDate(firstOpen?.date ?? dates.data?.dates[0]?.date ?? "");
    }
  }, [dates.data, selectedDate]);
  useEffect(() => setSelectedSlotId(""), [projectId, selectedDate]);

  const loading = labs.isLoading || projects.isLoading;
  return (
    <AppShell title="Slots" subtitle="Live MakerSpace availability">
      <div className="mx-auto max-w-5xl">
        {loading ? (
          <AvailabilityLoading />
        ) : leaderProjects.length === 0 ? (
          <NoProjects />
        ) : (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary text-primary-foreground shadow-sm">
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/65">
                    Availability preview
                  </p>
                  <h1 className="mt-3 max-w-2xl font-serif text-3xl font-light leading-tight sm:text-4xl">
                    Choose when your team wants to build.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                    Places reflect the selected project team. Equipment status is guidance only and
                    never reserves a machine.
                  </p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 lg:min-w-44">
                  <div className="flex items-center gap-2 text-white/65">
                    <Users className="size-4" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.16em]">
                      Team places
                    </span>
                  </div>
                  <p className="mt-2 font-serif text-3xl font-light">{participantCount}</p>
                  <p className="text-xs text-white/60">Derived from the project team</p>
                </div>
              </div>
            </section>

            <section className="card-surface p-5 sm:p-6">
              <label
                htmlFor="availability-project"
                className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary"
              >
                Project
              </label>
              <select
                id="availability-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-3 h-12 w-full rounded-xl border border-input bg-transparent px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
              >
                {leaderProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title} · {project.memberCount}{" "}
                    {project.memberCount === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
              {selectedProject && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge label={humanStatus(selectedProject.status)} />
                  <span>{selectedProject.statusMessage}</span>
                </div>
              )}
            </section>

            <section className="card-surface overflow-hidden">
              <div className="border-b border-border px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Choose a date</h2>
                </div>
                {dates.data && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dates.data.lab.name} · {dates.data.lab.timeZone} · Bookable through{" "}
                    {formatDate(dates.data.toDate)}
                  </p>
                )}
              </div>
              {dates.isLoading ? (
                <div className="flex gap-3 overflow-hidden p-5">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 w-28 shrink-0 animate-pulse rounded-xl bg-muted"
                    />
                  ))}
                </div>
              ) : dates.isError ? (
                <RetryMessage
                  label="Operating dates could not be loaded"
                  onRetry={() => dates.refetch()}
                />
              ) : (
                <div className="flex gap-3 overflow-x-auto p-5 [scrollbar-width:none]">
                  {dates.data?.dates.map((date) => {
                    const active = selectedDate === date.date;
                    return (
                      <button
                        key={date.date}
                        type="button"
                        disabled={!date.isOpen || !date.canFit}
                        onClick={() => setSelectedDate(date.date)}
                        className={cn(
                          "min-h-24 w-28 shrink-0 rounded-xl border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-md"
                            : "border-border bg-card hover:border-primary/40",
                          (!date.isOpen || !date.canFit) &&
                            "cursor-not-allowed bg-muted/50 opacity-55",
                        )}
                      >
                        <p
                          className={cn(
                            "text-[10px] font-mono uppercase tracking-wider",
                            active ? "text-white/65" : "text-muted-foreground",
                          )}
                        >
                          {date.label.split(",")[0]}
                        </p>
                        <p className="mt-1 font-serif text-lg font-light">{shortDate(date.date)}</p>
                        <p
                          className={cn(
                            "mt-2 text-[10px]",
                            active ? "text-white/65" : "text-muted-foreground",
                          )}
                        >
                          {date.isOpen ? `${date.slotCount} slots` : (date.reason ?? "Closed")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <section className="card-surface overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-primary" />
                      <h2 className="text-sm font-semibold">Available times</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {availability.data?.label ?? "Select an operating date"}
                    </p>
                  </div>
                  {availability.isFetching && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Refreshing
                    </span>
                  )}
                </div>
                {availability.isLoading ? (
                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : availability.isError ? (
                  <RetryMessage
                    label="Slot availability could not be loaded"
                    onRetry={() => availability.refetch()}
                  />
                ) : availability.data?.slots.length ? (
                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {availability.data.slots.map((slot) => {
                      const active = selectedSlotId === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!slot.canFit}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={cn(
                            "flex min-h-20 items-center justify-between gap-3 rounded-xl border px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                            active
                              ? "border-primary bg-primary/7"
                              : "border-border hover:border-primary/40",
                            !slot.canFit && "cursor-not-allowed bg-muted/50 opacity-55",
                          )}
                        >
                          <div>
                            <p className="font-serif text-lg font-light">
                              {slot.startTime}–{slot.endTime}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {slot.remainingCapacity} of {slot.bookingCapacity} places remain
                            </p>
                          </div>
                          <span
                            className={cn(
                              "grid size-6 place-items-center rounded-full border",
                              active && "border-primary bg-primary text-primary-foreground",
                            )}
                          >
                            {active ? <Check className="size-3.5" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-14 text-center text-sm text-muted-foreground">
                    {availability.data?.policy.reason ?? "No slots are available on this date."}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <section className="card-surface p-5">
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">Equipment advisory</h2>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {availability.data?.equipmentAdvisoryMessage ??
                      "Select a date to check the equipment declared by this project."}
                  </p>
                  <div className="mt-4 space-y-2">
                    {availability.data?.equipmentAdvisory.length ? (
                      availability.data.equipmentAdvisory.map((item) => (
                        <div
                          key={item.equipmentId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Need {item.requiredQuantity} · {item.availableQuantity} currently
                              available
                            </p>
                          </div>
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              item.available ? "bg-emerald-500" : "bg-amber-500",
                            )}
                          />
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                        This project has no expected equipment.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Availability is live</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Capacity refreshes automatically. Booking confirmation connects in the next
                        implementation phase.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground opacity-45"
                  >
                    Continue to booking <ChevronRight className="size-4" />
                  </button>
                </section>
              </aside>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NoProjects() {
  return (
    <section className="card-surface px-6 py-16 text-center sm:py-20">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
        Project required
      </p>
      <h2 className="mt-3 font-serif text-3xl font-light">
        Create a project before checking slots
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Availability is calculated from your project team and expected equipment.
      </p>
      <Link
        to="/projects"
        search={{ create: true }}
        className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        Create a project
      </Link>
    </section>
  );
}

function RetryMessage({ label, onRetry }: { label: string; onRetry: () => unknown }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm text-destructive">{label}.</p>
      <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-primary">
        Retry
      </button>
    </div>
  );
}

function AvailabilityLoading() {
  return (
    <div className="space-y-5" aria-label="Loading availability">
      <div className="h-52 animate-pulse rounded-2xl bg-primary/10" />
      <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}

function humanStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
