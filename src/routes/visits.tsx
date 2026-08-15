import { createFileRoute } from "@tanstack/react-router";
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
      { title: "Quick visit & history — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Request a quick MakerSpace visit and review your entry and exit history timeline.",
      },
      { property: "og:title", content: "Quick visit & history — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Request quick visits and track your MakerSpace visit history.",
      },
    ],
  }),
  component: VisitsPage,
});

function VisitsPage() {
  const { visits, addVisit } = useMakerSpace();
  const [purpose, setPurpose] = useState<string | null>(null);

  return (
    <AppShell title="Visits" subtitle="Quick access and visit history">
      <section className="card-surface p-5">
        <h2 className="text-base font-semibold">Request a quick visit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For short, non-project tasks. Pick a purpose and tap request.
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
                    : "border-border bg-card hover:bg-accent",
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
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
        >
          Request Quick Visit
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Visit history</h2>
        <ol className="relative space-y-3 border-l border-border pl-5">
          {visits.map((visit) => (
            <li key={visit.id} className="relative">
              <span
                className="absolute -left-[1.6rem] top-6 size-3 rounded-full border-2 border-background bg-primary"
                aria-hidden
              />
              <article className="card-surface p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{visit.title}</p>
                    <p className="text-xs text-muted-foreground">{visit.date}</p>
                  </div>
                  <StatusBadge label={visit.type} />
                </div>
                <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span>Entry {visit.entry}</span>
                  <span>Exit {visit.exit ?? "—"}</span>
                </p>
              </article>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
