import { createFileRoute } from "@tanstack/react-router";
import { DoorOpen, Footprints } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import { quickVisitPurposes } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/visits")({
  head: () => ({
    meta: [
      { title: "Visits — MIT-WPU MakerSpace" },
      {
        name: "description",
        content: "Request a quick MakerSpace visit and review your visit history.",
      },
    ],
  }),
  component: VisitsPage,
});

const durations = ["30 minutes", "1 hour", "2 hours", "Half day"];

function VisitsPage() {
  const { visits, addVisit, updateVisit, profile } = useMakerSpace();

  // This page is only about guest / quick visits — booked project sessions
  // live on the Slots page.
  const guestVisits = visits.filter(
    (visit) =>
      visit.type === "Quick Visit" &&
      visit.ownerEmail?.toLowerCase() === profile.email.toLowerCase(),
  );
  const openVisit = guestVisits.find((visit) => visit.status !== "Completed");
  const completed = guestVisits.filter((visit) => visit.status === "Completed" && visit.exit);
  const totalMinutes = completed.reduce(
    (total, visit) => total + minutesBetween(visit.entry, visit.exit),
    0,
  );

  return (
    <AppShell title="Visits" subtitle="Quick access and history">
      <div className="mx-auto max-w-3xl space-y-6">
        <section
          aria-label="Visit stats"
          className="card-surface flex items-stretch divide-x divide-border px-2 py-4"
        >
          {[
            { label: "Quick visits", value: String(completed.length) },
            { label: "Time in lab", value: formatMinutes(totalMinutes) },
            {
              label: "Longest visit",
              value: formatMinutes(
                completed.reduce(
                  (max, visit) => Math.max(max, minutesBetween(visit.entry, visit.exit)),
                  0,
                ),
              ),
            },
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
                  <p className="text-sm font-semibold">{openVisit.title}</p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {openVisit.status === "Requested"
                      ? `From ${openVisit.entry} · show PRN ${profile.prn} at the desk`
                      : `In the lab since ${openVisit.entry}`}
                    {openVisit.expectedDuration && ` · ~${openVisit.expectedDuration}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const now = new Date().toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  updateVisit(openVisit.id, { exit: now, status: "Completed" });
                  toast.success("Visit ended — see you next time");
                }}
                className="pressable inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
              >
                <DoorOpen className="size-4" /> End visit
              </button>
            </div>
          </section>
        ) : (
          <QuickVisitForm
            onSubmit={(visit) => {
              addVisit(visit);
              toast.success("Quick visit requested. Show your PRN at the desk.");
            }}
          />
        )}

        <section>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
            History
          </p>
          {guestVisits.length ? (
            <ol className="relative ml-2 space-y-3 border-l border-border pl-6">
              {guestVisits.map((visit) => {
                const minutes = minutesBetween(visit.entry, visit.exit);
                return (
                  <li key={visit.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[1.83rem] top-6 size-3 rounded-full border-2 border-background",
                        visit.exit ? "bg-primary" : "bg-muted-foreground/50",
                      )}
                      aria-hidden
                    />
                    <article className="card-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{visit.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {visit.date} · in {visit.entry} · out {visit.exit ?? "—"}
                            {minutes > 0 && ` · ${formatMinutes(minutes)}`}
                          </p>
                        </div>
                        <StatusBadge
                          label={visit.status === "Completed" ? "Completed" : visit.status}
                        />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="card-surface px-6 py-12 text-center text-sm text-muted-foreground">
              Your quick visits will appear here.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

/* ── Request form: purpose (incl. custom), start time, duration ── */

function QuickVisitForm({
  onSubmit,
}: {
  onSubmit: (visit: {
    type: "Quick Visit";
    title: string;
    date: string;
    entry: string;
    exit: null;
    status: "Requested";
    expectedDuration: string;
  }) => void;
}) {
  const [purpose, setPurpose] = useState<string | null>(null);
  const [customPurpose, setCustomPurpose] = useState("");
  const [startTime, setStartTime] = useState(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
  );
  const [duration, setDuration] = useState(durations[1]!);

  const isCustom = purpose === "custom";
  const title = isCustom ? customPurpose.trim() : purpose;
  const ready = Boolean(title) && Boolean(startTime);

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
        {quickVisitPurposes.map((item) => (
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
              {item}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-pressed={isCustom}
            onClick={() => setPurpose("custom")}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              isCustom
                ? "border-primary bg-primary text-primary-foreground"
                : "border-dashed border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            Something else…
          </button>
        </li>
      </ul>
      {isCustom && (
        <input
          type="text"
          autoFocus
          value={customPurpose}
          onChange={(event) => setCustomPurpose(event.target.value)}
          placeholder="What do you need to do?"
          className="mt-3 h-11 w-full rounded-xl border border-border bg-secondary/40 px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Arriving at
          </p>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/40 px-4 font-mono text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Expected duration
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {durations.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={duration === option}
                onClick={() => setDuration(option)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                  duration === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          const now = new Date();
          onSubmit({
            type: "Quick Visit",
            title: title!,
            date: now.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            entry: startTime,
            exit: null,
            status: "Requested",
            expectedDuration: duration,
          });
          setPurpose(null);
          setCustomPurpose("");
        }}
        className="pressable mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
      >
        Request quick visit
      </button>
    </section>
  );
}

function minutesBetween(entry: string, exit: string | null) {
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
