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

function VisitsPage() {
  const { visits, addVisit, updateVisit, profile } = useMakerSpace();
  const [purpose, setPurpose] = useState<string | null>(null);
  const studentVisits = visits.filter(
    (visit) => visit.ownerEmail?.toLowerCase() === profile.email.toLowerCase(),
  );
  const openVisit = studentVisits.find((visit) => !visit.exit);
  const completed = studentVisits.filter((visit) => visit.status === "Completed" && visit.exit);
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
            { label: "Total visits", value: String(completed.length) },
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
                      ? `Requested · show PRN ${profile.prn} at the desk`
                      : `In the lab since ${openVisit.entry}`}
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
          <section className="card-surface p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              Quick visit
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              For short, non-project tasks — pick a purpose and drop in.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
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
            </ul>
            <button
              type="button"
              disabled={!purpose}
              onClick={() => {
                const now = new Date();
                addVisit({
                  type: "Quick Visit",
                  title: purpose!,
                  date: now.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
                  entry: now.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }),
                  exit: null,
                  status: "Requested",
                });
                setPurpose(null);
                toast.success("Quick visit requested. Show your PRN at the desk.");
              }}
              className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
            >
              Request quick visit
            </button>
          </section>
        )}

        <section>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
            History
          </p>
          {studentVisits.length ? (
            <ol className="relative ml-2 space-y-3 border-l border-border pl-6">
              {studentVisits.map((visit) => {
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
                        <StatusBadge label={visit.type} />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="card-surface px-6 py-12 text-center text-sm text-muted-foreground">
              Your visit history will appear after your first MakerSpace visit.
            </div>
          )}
        </section>
      </div>
    </AppShell>
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
