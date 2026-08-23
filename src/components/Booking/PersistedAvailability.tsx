import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Info,
  RefreshCw,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookingCapacityBench } from "@/components/Booking/BookingCapacityBench";
import { BookingConfirmation } from "@/components/Booking/BookingConfirmation";
import { BookingSummaryCard } from "@/components/Booking/BookingSummaryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ApiError,
  bookingsApi,
  labsApi,
  type ApiResponse,
  type BookingDto,
  type BookingParticipantDto,
  type DailyAvailability,
  type ProjectDetail,
} from "@/lib/api";
import { invalidateBookingData, usePersistedBookings } from "@/lib/booking-queries";
import { usePersistedProject, usePersistedProjects } from "@/lib/project-queries";
import { cn } from "@/lib/utils";

type SlotsTab = "upcoming" | "book" | "past";
type AvailabilitySlot = DailyAvailability["slots"][number];

export function PersistedAvailability({
  preselectedProjectId,
}: {
  preselectedProjectId?: string | undefined;
}) {
  const [tab, setTab] = useState<SlotsTab>(preselectedProjectId ? "book" : "upcoming");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const upcoming = usePersistedBookings("upcoming", upcomingPage, 20, tab === "upcoming");
  const past = usePersistedBookings("past", pastPage, 20, tab === "past");
  const upcomingTotal = upcoming.data?.meta?.total ?? upcoming.data?.data.length ?? 0;
  const pastTotal = past.data?.meta?.total ?? past.data?.data.length ?? 0;

  return (
    <AppShell
      title="Slots"
      subtitle={tab === "book" ? "Reserve MakerSpace time" : "Your MakerSpace bookings"}
    >
      <div className="mx-auto max-w-5xl">
        <div
          role="tablist"
          aria-label="Slot views"
          className="grid rounded-2xl border border-border bg-card p-1 sm:inline-grid sm:grid-cols-3"
        >
          <TabButton
            active={tab === "upcoming"}
            label="Upcoming"
            count={upcomingTotal}
            onClick={() => setTab("upcoming")}
          />
          <TabButton
            active={tab === "book"}
            label="Available Slots"
            onClick={() => setTab("book")}
          />
          <TabButton
            active={tab === "past"}
            label="Past"
            count={pastTotal}
            onClick={() => setTab("past")}
          />
        </div>

        <div className="mt-6">
          {tab === "book" ? (
            <BookingFlow
              preselectedProjectId={preselectedProjectId}
              onBooked={() => {
                setUpcomingPage(1);
                setTab("upcoming");
              }}
            />
          ) : tab === "upcoming" ? (
            <BookingCollection
              rows={upcoming.data?.data ?? []}
              loading={upcoming.isLoading}
              error={upcoming.isError}
              meta={upcoming.data?.meta}
              emptyTitle="No upcoming bookings"
              emptyMessage="Choose an eligible verified project and reserve MakerSpace time for your team."
              emptyAction="Find a slot"
              onEmptyAction={() => setTab("book")}
              onRetry={() => upcoming.refetch()}
              onPageChange={setUpcomingPage}
            />
          ) : (
            <BookingCollection
              rows={past.data?.data ?? []}
              loading={past.isLoading}
              error={past.isError}
              meta={past.data?.meta}
              emptyTitle="No booking history yet"
              emptyMessage="Completed, cancelled and no-show bookings will remain here for reference."
              onRetry={() => past.refetch()}
              onPageChange={setPastPage}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-mono",
            active ? "bg-white/15 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BookingFlow({
  preselectedProjectId,
  onBooked,
}: {
  preselectedProjectId?: string | undefined;
  onBooked: () => void;
}) {
  const queryClient = useQueryClient();
  const projects = usePersistedProjects({ status: "VERIFIED" });
  const leaderProjects = useMemo(
    () =>
      (projects.data ?? []).filter(
        (project) => project.viewerRelationship === "LEADER" && project.status === "VERIFIED",
      ),
    [projects.data],
  );
  const [projectId, setProjectId] = useState(preselectedProjectId ?? "");
  const project = leaderProjects.find((item) => item.id === projectId);
  const projectDetail = usePersistedProject(projectId, Boolean(projectId));
  const acceptedParticipants = useMemo(
    () => acceptedProjectParticipants(projectDetail.data),
    [projectDetail.data],
  );
  const [participantProjectId, setParticipantProjectId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const participantCount = participantIds.length;
  const labId = project?.labId ?? "";
  const dates = useQuery({
    queryKey: ["availability-dates", labId, projectId, participantCount],
    queryFn: () =>
      labsApi
        .availabilityDates(labId, projectId, participantCount)
        .then((response) => response.data),
    enabled: Boolean(labId && projectId && participantCount),
    staleTime: 30_000,
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const availability = useQuery({
    queryKey: ["daily-availability", labId, selectedDate, projectId, participantCount],
    queryFn: () =>
      labsApi
        .dailyAvailability(labId, selectedDate, projectId, participantCount)
        .then((response) => response.data),
    enabled: Boolean(labId && selectedDate && projectId && participantCount),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const selectedSlot = availability.data?.slots.find((slot) => slot.id === selectedSlotId);
  const leaderRequired = availability.data?.lab.teamLeaderAttendanceRequired ?? true;
  const leaderId = acceptedParticipants.find(
    (participant) => participant.role === "LEADER",
  )?.userId;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const bookingRequest = useRef<{ signature: string; idempotencyKey: string } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!leaderProjects.length) return;
    if (!leaderProjects.some((item) => item.id === projectId)) {
      const preferred = leaderProjects.find((item) => item.id === preselectedProjectId);
      setProjectId(preferred?.id ?? leaderProjects[0]!.id);
    }
  }, [leaderProjects, preselectedProjectId, projectId]);

  useEffect(() => {
    if (!projectDetail.data || participantProjectId === projectId) return;
    setParticipantIds(acceptedProjectParticipants(projectDetail.data).map((item) => item.userId));
    setParticipantProjectId(projectId);
    setSelectedDate("");
    setSelectedSlotId("");
    setConflictMessage(null);
  }, [participantProjectId, projectDetail.data, projectId]);

  useEffect(() => {
    if (!leaderRequired || !leaderId) return;
    setParticipantIds((current) => (current.includes(leaderId) ? current : [leaderId, ...current]));
  }, [leaderId, leaderRequired]);

  useEffect(() => {
    if (!dates.data) return;
    const current = dates.data.dates.find((date) => date.date === selectedDate);
    if (!current?.isOpen || !current.canFit) {
      const firstOpen = dates.data.dates.find((date) => date.isOpen && date.canFit);
      setSelectedDate(firstOpen?.date ?? "");
    }
  }, [dates.data, selectedDate]);

  useEffect(() => {
    setSelectedSlotId("");
    setConflictMessage(null);
  }, [participantIds, selectedDate, projectId]);

  useEffect(() => {
    if (!selectedSlotId || !availability.data) return;
    const refreshed = availability.data.slots.find((slot) => slot.id === selectedSlotId);
    if (!refreshed?.canFit) {
      setSelectedSlotId("");
      setConflictMessage(
        refreshed
          ? `That slot now has ${refreshed.remainingCapacity} ${refreshed.remainingCapacity === 1 ? "place" : "places"} remaining. Choose another time for your ${participantCount}-person team.`
          : "That slot is no longer available. Choose another time below.",
      );
    }
  }, [availability.data, participantCount, selectedSlotId]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedSlot) throw new Error("Choose an available slot first");
      const normalizedNotes = notes.trim() || null;
      const signature = JSON.stringify({
        labSlotId: selectedSlot.id,
        projectId,
        participantIds: [...participantIds].sort(),
        notes: normalizedNotes,
      });
      const idempotencyKey =
        bookingRequest.current?.signature === signature
          ? bookingRequest.current.idempotencyKey
          : crypto.randomUUID();
      bookingRequest.current = { signature, idempotencyKey };
      return bookingsApi.create({
        labSlotId: selectedSlot.id,
        projectId,
        participantIds,
        idempotencyKey,
        notes: normalizedNotes,
      });
    },
    onSuccess: async ({ data }) => {
      await invalidateBookingData(queryClient, data.booking.id, data.booking.projectId);
      setConfirmOpen(false);
      setSubmissionError(null);
      setNotes("");
      bookingRequest.current = null;
      toast.success(data.replayed ? "Booking already confirmed" : "MakerSpace booking confirmed");
      onBooked();
    },
    onError: (error) => {
      if (isCapacityConflict(error)) {
        const remaining = conflictRemainingCapacity(error);
        setConflictMessage(
          remaining === null
            ? "This slot filled while you were confirming. Availability has been refreshed; choose an alternate slot."
            : `This slot filled while you were confirming. Only ${remaining} ${remaining === 1 ? "place remains" : "places remain"}. Choose an alternate slot below.`,
        );
        setSelectedSlotId("");
        setConfirmOpen(false);
        setSubmissionError(null);
        void availability.refetch();
        return;
      }
      setSubmissionError(
        error instanceof ApiError
          ? error.message
          : "The booking was not confirmed. Check your connection and try again with the same request.",
      );
    },
  });

  if (projects.isLoading) return <BookingFlowLoading />;
  if (projects.isError) {
    return (
      <RetryState
        title="Eligible projects could not be loaded"
        message="Check your connection and try again. Your booking has not been started."
        onRetry={() => projects.refetch()}
      />
    );
  }
  if (!leaderProjects.length) return <NoEligibleProjects />;

  const selectedParticipants = acceptedParticipants.filter((participant) =>
    participantIds.includes(participant.userId),
  );
  const equipment = availability.data?.equipmentAdvisory ?? [];
  const equipmentAvailableCount = equipment.filter((item) => item.available).length;
  const projectEligible = availability.data?.project?.eligibleForBooking ?? true;

  const changeProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setParticipantProjectId("");
    setParticipantIds([]);
    setSelectedDate("");
    setSelectedSlotId("");
    setConflictMessage(null);
    setSubmissionError(null);
  };

  const toggleParticipant = (participant: BookingParticipantDto) => {
    if (participant.role === "LEADER" && leaderRequired) return;
    setParticipantIds((current) =>
      current.includes(participant.userId)
        ? current.filter((id) => id !== participant.userId)
        : [...current, participant.userId],
    );
  };

  const openConfirmation = () => {
    setSubmissionError(null);
    createMutation.reset();
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary text-primary-foreground shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/65">
              Live capacity booking
            </p>
            <h1 className="mt-3 max-w-2xl font-serif text-3xl font-light leading-tight sm:text-4xl">
              Bring the right team to the bench.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Accepted members are selected automatically. Equipment status is guidance only and
              never reserves a machine.
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 lg:min-w-48">
            <div className="flex items-center gap-2 text-white/65">
              <Users className="size-4" aria-hidden />
              <span className="text-[10px] font-mono uppercase tracking-[0.16em]">
                Team attending
              </span>
            </div>
            <p className="mt-2 font-serif text-3xl font-light">{participantCount}</p>
            <p className="text-xs text-white/60">Capacity is based on selected people</p>
          </div>
        </div>
      </section>

      <BookingStep
        number="01"
        title="Select a verified project"
        aside={`${leaderProjects.length} eligible`}
      >
        <label htmlFor="booking-project" className="sr-only">
          Verified project
        </label>
        <select
          id="booking-project"
          value={projectId}
          onChange={(event) => changeProject(event.target.value)}
          className="h-12 w-full rounded-xl border border-input bg-transparent px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
        >
          {leaderProjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        {project && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge label="Verified" />
            <span>{project.statusMessage}</span>
          </div>
        )}
      </BookingStep>

      <BookingStep
        number="02"
        title="Choose who is coming"
        aside={`${participantCount} of ${acceptedParticipants.length} selected`}
      >
        {projectDetail.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : projectDetail.isError ? (
          <RetryInline
            label="Project team could not be loaded"
            onRetry={() => projectDetail.refetch()}
          />
        ) : acceptedParticipants.length ? (
          <ul className="divide-y divide-border">
            {acceptedParticipants.map((participant) => {
              const leader = participant.role === "LEADER";
              const locked = leader && leaderRequired;
              return (
                <li key={participant.userId}>
                  <label
                    className={cn(
                      "flex min-h-14 items-center gap-3 py-2",
                      locked ? "cursor-default" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      checked={participantIds.includes(participant.userId)}
                      disabled={locked}
                      onCheckedChange={() => toggleParticipant(participant)}
                      className="size-6"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{participant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {leader
                          ? locked
                            ? "Team Leader · Required"
                            : "Team Leader"
                          : participant.email}
                      </span>
                    </span>
                    {participantIds.includes(participant.userId) && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                        Attending
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            This project has no accepted members available for booking. Refresh the project before
            continuing.
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Only accepted project members are shown. The backend verifies every selected person again
          when the booking is confirmed.
        </p>
      </BookingStep>

      <BookingStep number="03" title="Choose a date">
        {dates.isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 w-28 shrink-0 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : dates.isError ? (
          <RetryInline
            label="Operating dates could not be loaded"
            onRetry={() => dates.refetch()}
          />
        ) : participantCount === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Select at least one accepted participant to see dates.
          </p>
        ) : (
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
            {dates.data?.dates.map((date) => {
              const active = selectedDate === date.date;
              return (
                <button
                  key={date.date}
                  type="button"
                  disabled={!date.isOpen || !date.canFit}
                  onClick={() => setSelectedDate(date.date)}
                  className={cn(
                    "min-h-24 w-28 shrink-0 snap-start rounded-xl border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card hover:border-primary/40",
                    (!date.isOpen || !date.canFit) && "cursor-not-allowed bg-muted/50 opacity-55",
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
      </BookingStep>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-start">
        <BookingStep number="04" title="Choose a time" aside={availability.data?.label}>
          {conflictMessage && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm text-warning-foreground"
            >
              <p>{conflictMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setConflictMessage(null);
                  void availability.refetch();
                }}
                className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold"
              >
                <RefreshCw className="size-4" aria-hidden /> Refresh availability
              </button>
            </div>
          )}

          {availability.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : availability.isError ? (
            <RetryInline
              label="Slot availability could not be loaded"
              onRetry={() => availability.refetch()}
            />
          ) : availability.data?.slots.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {availability.data.slots.map((slot) => (
                <SlotButton
                  key={slot.id}
                  slot={slot}
                  selected={slot.id === selectedSlotId}
                  equipmentCount={equipment.length}
                  equipmentAvailableCount={equipmentAvailableCount}
                  onSelect={() => {
                    setSelectedSlotId(slot.id);
                    setConflictMessage(null);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <Clock3 className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                {availability.data?.policy.reason ?? "No slots are available on this date."}
              </p>
            </div>
          )}
        </BookingStep>

        <aside className="space-y-4 lg:sticky lg:top-28">
          {selectedSlot ? (
            <BookingCapacityBench
              capacity={selectedSlot.bookingCapacity}
              placesUsed={selectedSlot.placesUsed}
              selectedCount={participantCount}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.035] p-5">
              <p className="text-sm font-semibold text-primary">MakerSpace bench</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Select a time to see how your team fits alongside existing reservations.
              </p>
            </section>
          )}

          <EquipmentAdvisory items={equipment} loading={availability.isLoading} />

          {!projectEligible && availability.data?.project && (
            <p className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
              {availability.data.project.eligibilityMessage}
            </p>
          )}

          <section className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-primary/15 bg-card/95 p-4 shadow-xl backdrop-blur md:static md:shadow-sm">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="text-xs leading-5 text-muted-foreground">
                The server checks membership and live capacity again before confirming.
              </p>
            </div>
            <button
              type="button"
              disabled={!selectedSlot || participantCount === 0 || !projectEligible}
              onClick={openConfirmation}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-45"
            >
              Review booking <ChevronRight className="size-4" aria-hidden />
            </button>
          </section>
        </aside>
      </div>

      {selectedSlot && project && (
        <BookingConfirmation
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          projectTitle={project.title}
          date={availability.data?.label ?? selectedDate}
          time={`${selectedSlot.startTime}–${selectedSlot.endTime}`}
          participants={selectedParticipants}
          equipment={equipment}
          capacity={selectedSlot.bookingCapacity}
          placesUsed={selectedSlot.placesUsed}
          notes={notes}
          onNotesChange={(value) => {
            setNotes(value);
            if (createMutation.isError) {
              setSubmissionError(null);
              createMutation.reset();
            }
          }}
          pending={createMutation.isPending}
          error={submissionError}
          onConfirm={() => createMutation.mutate()}
        />
      )}
    </div>
  );
}

function BookingStep({
  number,
  title,
  aside,
  children,
}: {
  number: string;
  title: string;
  aside?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-[10px] tracking-wider text-primary">{number}</span>
          {title}
        </h2>
        {aside && (
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function SlotButton({
  slot,
  selected,
  equipmentCount,
  equipmentAvailableCount,
  onSelect,
}: {
  slot: AvailabilitySlot;
  selected: boolean;
  equipmentCount: number;
  equipmentAvailableCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!slot.canFit}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "min-h-24 w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
        selected ? "border-primary bg-primary/7" : "border-border hover:border-primary/40",
        !slot.canFit && "cursor-not-allowed bg-muted/50 opacity-55",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block font-serif text-lg font-light">
            {slot.startTime}–{slot.endTime}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {slot.remainingCapacity} of {slot.bookingCapacity} places remain
          </span>
        </span>
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border",
            selected && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {selected ? <Check className="size-3.5" aria-hidden /> : null}
        </span>
      </span>
      <span className="mt-3 flex items-center gap-2 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
        <Wrench className="size-3.5" aria-hidden />
        {equipmentCount
          ? `${equipmentAvailableCount}/${equipmentCount} expected equipment currently available`
          : "No expected equipment declared"}
      </span>
    </button>
  );
}

function EquipmentAdvisory({
  items,
  loading,
}: {
  items: DailyAvailability["equipmentAdvisory"];
  loading: boolean;
}) {
  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <Wrench className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Equipment advisory</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Current status for the equipment declared by this project. It does not block this booking.
      </p>
      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted" />
      ) : items.length ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.equipmentId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Need {item.requiredQuantity} · {item.availableQuantity} available
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[9px] font-mono uppercase tracking-wider",
                  item.available ? "text-success-foreground" : "text-warning-foreground",
                )}
              >
                {item.available ? "Available" : "Unavailable"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          This project has no expected equipment.
        </p>
      )}
    </section>
  );
}

function BookingCollection({
  rows,
  loading,
  error,
  meta,
  emptyTitle,
  emptyMessage,
  emptyAction,
  onEmptyAction,
  onRetry,
  onPageChange,
}: {
  rows: BookingDto[];
  loading: boolean;
  error: boolean;
  meta?: ApiResponse<BookingDto[]>["meta"];
  emptyTitle: string;
  emptyMessage: string;
  emptyAction?: string;
  onEmptyAction?: () => void;
  onRetry: () => unknown;
  onPageChange: (page: number) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading bookings">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <RetryState
        title="Bookings could not be loaded"
        message="Check your connection and try again."
        onRetry={onRetry}
      />
    );
  }
  if (!rows.length) {
    return (
      <section className="card-surface px-6 py-14 text-center sm:py-20">
        <CalendarDays className="mx-auto size-7 text-primary" aria-hidden />
        <h2 className="mt-4 font-serif text-2xl font-light sm:text-3xl">{emptyTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </p>
        {emptyAction && onEmptyAction && (
          <button
            type="button"
            onClick={onEmptyAction}
            className="mt-6 min-h-12 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            {emptyAction}
          </button>
        )}
      </section>
    );
  }
  return (
    <div>
      <div className="space-y-4">
        {rows.map((booking) => (
          <BookingSummaryCard key={booking.id} booking={booking} />
        ))}
      </div>
      {meta && meta.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Booking pages">
          <button
            type="button"
            disabled={!meta.hasPrev}
            onClick={() => onPageChange(meta.page - 1)}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!meta.hasNext}
            onClick={() => onPageChange(meta.page + 1)}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

function RetryState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => unknown;
}) {
  return (
    <section className="card-surface px-6 py-14 text-center">
      <h2 className="font-serif text-2xl font-light">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        <RefreshCw className="size-4" aria-hidden /> Try again
      </button>
    </section>
  );
}

function RetryInline({ label, onRetry }: { label: string; onRetry: () => unknown }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center">
      <p className="text-sm text-destructive">{label}.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 text-sm font-semibold text-primary"
      >
        Retry
      </button>
    </div>
  );
}

function BookingFlowLoading() {
  return (
    <div className="space-y-5" aria-label="Loading booking flow">
      <div className="h-52 animate-pulse rounded-2xl bg-primary/10" />
      <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}

function NoEligibleProjects() {
  return (
    <section className="card-surface px-6 py-16 text-center sm:py-20">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
        Verified project required
      </p>
      <h2 className="mt-3 font-serif text-3xl font-light">No project is ready to book yet</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
        Only the Team Leader of a verified project can reserve MakerSpace capacity. Open Projects to
        check team acceptance and Faculty Mentor approval.
      </p>
      <Link
        to="/projects"
        className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        Review projects
      </Link>
    </section>
  );
}

function acceptedProjectParticipants(project?: ProjectDetail): BookingParticipantDto[] {
  if (!project) return [];
  return project.members
    .filter(
      (member): member is typeof member & { userId: string } =>
        member.status === "ACCEPTED" && Boolean(member.userId),
    )
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      email: member.email,
      role: member.role,
    }))
    .sort((a, b) => Number(b.role === "LEADER") - Number(a.role === "LEADER"));
}

function isCapacityConflict(error: unknown) {
  return (
    error instanceof ApiError &&
    ["SLOT_CAPACITY_EXCEEDED", "TRANSACTION_CONFLICT", "SLOT_UNAVAILABLE"].includes(error.code)
  );
}

function conflictRemainingCapacity(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  for (const detail of error.details) {
    if (
      detail &&
      typeof detail === "object" &&
      "remainingCapacity" in detail &&
      typeof detail.remainingCapacity === "number"
    ) {
      return detail.remainingCapacity;
    }
  }
  return null;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
