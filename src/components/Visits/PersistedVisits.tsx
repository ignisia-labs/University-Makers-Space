import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Footprints, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import {
  labsApi,
  quickVisitsApi,
  readableError,
  referenceApi,
  visitsApi,
  type QuickVisitDto,
  type VisitDto,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const purposes = [
  "Component pickup",
  "Consult lab assistant",
  "Measure / test part",
  "Return material",
  "Explore equipment",
];

/**
 * Quick Visits — short, non-project trips to the MakerSpace.
 *
 * Booked project sessions live on the Slots page; mixing the two here was what
 * made this screen hard to read.
 */
export function PersistedVisits() {
  const queryClient = useQueryClient();

  const labs = useQuery({
    queryKey: ["reference-labs"],
    queryFn: () => referenceApi.labs().then((response) => response.data),
    staleTime: 300_000,
  });
  const lab = labs.data?.[0] ?? null;
  const timeZone = lab?.timeZone ?? "Asia/Kolkata";

  const quickVisits = useQuery({
    queryKey: ["quick-visits", "mine"],
    queryFn: () => quickVisitsApi.list({ scope: "upcoming", limit: "20" }).then((r) => r.data),
    staleTime: 15_000,
  });
  const history = useQuery({
    queryKey: ["visits", "mine"],
    queryFn: () => visitsApi.list({ limit: "50" }).then((response) => response.data),
    staleTime: 15_000,
  });

  const visits = history.data ?? [];
  const completed = visits.filter((visit) => visit.checkedOutAt && visit.durationMinutes !== null);
  const totalMinutes = completed.reduce((sum, visit) => sum + (visit.durationMinutes ?? 0), 0);
  const longest = completed.reduce((max, visit) => Math.max(max, visit.durationMinutes ?? 0), 0);

  // The one visit you are inside right now, if any.
  const openVisit = visits.find((visit) => visit.status === "CHECKED_IN") ?? null;
  const liveRequest =
    quickVisits.data?.find(
      (entry) =>
        entry.status === "REQUESTED" || entry.status === "CONFIRMED" || entry.status === "ACTIVE",
    ) ?? null;

  const checkOut = useMutation({
    mutationFn: (id: string) => visitsApi.checkOut(id, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["visits"] });
      await queryClient.invalidateQueries({ queryKey: ["quick-visits"] });
      toast.success("Visit ended — see you next time");
    },
    onError: (error) => toast.error(readableError(error, "Could not end this visit")),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) =>
      quickVisitsApi.cancel(id, {
        reason: "Cancelled by the student",
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quick-visits"] });
      toast.success("Quick visit cancelled");
    },
    onError: (error) => toast.error(readableError(error, "Could not cancel this request")),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section
        aria-label="Visit stats"
        className="card-surface flex items-stretch divide-x divide-border px-2 py-4"
      >
        {[
          { label: "Quick visits", value: String(completed.length) },
          { label: "Time in lab", value: formatMinutes(totalMinutes) },
          { label: "Longest visit", value: formatMinutes(longest) },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 px-4 text-center sm:px-6">
            <p className="font-serif text-2xl font-light text-foreground sm:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {openVisit ? (
        <section className="card-surface p-5" aria-label="Current visit">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <Footprints className="size-4.5" />
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">{openVisit.projectTitle ?? "Quick visit"}</p>
                <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  In the lab since {clock(openVisit.checkedInAt, openVisit.timeZone)}
                </p>
              </div>
            </div>
            {openVisit.canCheckOut && (
              <button
                type="button"
                disabled={checkOut.isPending}
                onClick={() => checkOut.mutate(openVisit.id)}
                className="pressable inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
              >
                {checkOut.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <DoorOpen className="size-4" />
                )}
                End visit
              </button>
            )}
          </div>
        </section>
      ) : liveRequest ? (
        <PendingRequest
          request={liveRequest}
          busy={cancelRequest.isPending}
          onCancel={() => cancelRequest.mutate(liveRequest.id)}
        />
      ) : (
        <QuickVisitForm
          labId={lab?.id ?? null}
          timeZone={timeZone}
          onCreated={async () => {
            await queryClient.invalidateQueries({ queryKey: ["quick-visits"] });
          }}
        />
      )}

      <section>
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">History</p>
        {history.isPending ? (
          <div className="card-surface h-32 animate-pulse bg-muted/40" aria-busy="true" />
        ) : visits.length ? (
          <ol className="relative ml-2 space-y-3 border-l border-border pl-6">
            {visits.map((visit) => (
              <li key={visit.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.83rem] top-6 size-3 rounded-full border-2 border-background",
                    visit.checkedOutAt ? "bg-primary" : "bg-muted-foreground/50",
                  )}
                  aria-hidden
                />
                <article className="card-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {visit.projectTitle ?? "Quick visit"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {longDate(visit.checkedInAt, visit.timeZone)} · in{" "}
                        {clock(visit.checkedInAt, visit.timeZone)} · out{" "}
                        {visit.checkedOutAt ? clock(visit.checkedOutAt, visit.timeZone) : "—"}
                        {visit.durationMinutes !== null &&
                          ` · ${formatMinutes(visit.durationMinutes)}`}
                      </p>
                    </div>
                    <StatusBadge label={visit.statusLabel} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="card-surface px-6 py-12 text-center text-sm text-muted-foreground">
            Your quick visits will appear here.
          </div>
        )}
      </section>
    </div>
  );
}

function PendingRequest({
  request,
  busy,
  onCancel,
}: {
  request: QuickVisitDto;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <section className="card-surface p-5" aria-label="Requested quick visit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <Footprints className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{request.purpose}</p>
            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {clock(request.startsAt, request.timeZone)} –{" "}
              {clock(request.endsAt, request.timeZone)} · show your PRN at the desk
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge label={request.statusLabel} />
          {request.canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="pressable min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Request form: purpose (incl. custom), then an open slot ───── */

function QuickVisitForm({
  labId,
  timeZone,
  onCreated,
}: {
  labId: string | null;
  timeZone: string;
  onCreated: () => Promise<void>;
}) {
  const [purpose, setPurpose] = useState<string | null>(null);
  const [customPurpose, setCustomPurpose] = useState("");
  const [date, setDate] = useState(() => today(timeZone));
  const [slotId, setSlotId] = useState("");

  const isCustom = purpose === "custom";
  const title = (isCustom ? customPurpose.trim() : (purpose ?? "")).trim();

  const day = useQuery({
    queryKey: ["quick-visit-slots", labId, date],
    queryFn: () => labsApi.dailyAvailability(labId!, date).then((response) => response.data),
    enabled: Boolean(labId && date),
    staleTime: 15_000,
  });
  const openSlots = useMemo(
    () => (day.data?.slots ?? []).filter((slot) => slot.quickVisitSeatsLeft > 0),
    [day.data],
  );
  useEffect(() => {
    if (openSlots.some((slot) => slot.id === slotId)) return;
    setSlotId(openSlots[0]?.id ?? "");
  }, [openSlots, slotId]);

  const create = useMutation({
    mutationFn: () =>
      quickVisitsApi.create({
        labSlotId: slotId,
        purpose: title,
        // A fresh key per submission: a retried network request collapses onto
        // the same Quick Visit rather than consuming a second seat.
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await onCreated();
      setPurpose(null);
      setCustomPurpose("");
      toast.success("Quick visit requested. Show your PRN at the desk.");
    },
    onError: (error) => toast.error(readableError(error, "Could not request this visit")),
  });

  const ready = Boolean(title && slotId) && !create.isPending;

  return (
    <section className="card-surface p-5 sm:p-6">
      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Quick visit</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        For short, non-project tasks — tell the desk what you need and when you're coming.
      </p>

      <p className="mt-5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Purpose
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {[...purposes, "custom"].map((item) => (
          <li key={item}>
            <button
              type="button"
              aria-pressed={purpose === item}
              onClick={() => setPurpose(item)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                purpose === item
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {item === "custom" ? "Something else" : item}
            </button>
          </li>
        ))}
      </ul>
      {isCustom && (
        <input
          value={customPurpose}
          onChange={(event) => setCustomPurpose(event.target.value)}
          placeholder="What do you need?"
          maxLength={120}
          className="form-input mt-3"
        />
      )}

      <p className="mt-5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Day
      </p>
      <input
        type="date"
        value={date}
        min={today(timeZone)}
        onChange={(event) => setDate(event.target.value)}
        className="form-input mt-2"
      />

      <p className="mt-5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Time
      </p>
      {day.isPending ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading open times…</p>
      ) : openSlots.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No walk-in seats are left on this day. Try another date.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {openSlots.map((slot) => (
            <li key={slot.id}>
              <button
                type="button"
                aria-pressed={slot.id === slotId}
                onClick={() => setSlotId(slot.id)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                  slot.id === slotId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {slot.startTime} – {slot.endTime}
                <span className="ml-2 text-[10px] font-mono uppercase tracking-wider opacity-70">
                  {slot.quickVisitSeatsLeft} left
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={!ready}
        onClick={() => create.mutate()}
        className="pressable mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Request quick visit
      </button>
    </section>
  );
}

/* ── helpers ──────────────────────────────────────────────────── */

export function formatMinutes(total: number) {
  if (total <= 0) return "0m";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function clock(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function longDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}

function today(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
