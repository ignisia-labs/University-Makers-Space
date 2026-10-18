import { Armchair, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookingCapacityBench({
  capacity,
  placesUsed,
  selectedCount,
  compact = false,
}: {
  capacity: number;
  placesUsed: number;
  selectedCount: number;
  compact?: boolean;
}) {
  const total = Math.max(1, capacity);
  const occupied = Math.min(Math.max(0, placesUsed), total);
  const selected = Math.min(Math.max(0, selectedCount), Math.max(0, total - occupied));
  const remaining = Math.max(0, total - occupied - selected);

  return (
    <section
      aria-label={`${occupied} places already reserved, ${selected} selected for this booking, ${remaining} places would remain`}
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.045]",
        compact ? "p-4" : "p-5",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Armchair className="size-4" aria-hidden />
            <h3 className="text-sm font-semibold">MakerSpace bench</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">How this team fits into the slot</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-card px-3 py-1 text-xs font-semibold text-primary">
          <Users className="size-3.5" aria-hidden /> {selected} selected
        </span>
      </div>

      <div
        className="mt-4 flex h-4 overflow-hidden rounded-full border border-border bg-card"
        aria-hidden
      >
        {occupied > 0 && <span className="bg-muted-foreground/35" style={{ flexGrow: occupied }} />}
        {selected > 0 && <span className="bg-primary" style={{ flexGrow: selected }} />}
        {remaining > 0 && <span className="bg-success/35" style={{ flexGrow: remaining }} />}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <BenchFact label="Reserved" value={occupied} tone="neutral" />
        <BenchFact label="Your team" value={selected} tone="primary" />
        <BenchFact label="Remain" value={remaining} tone="success" />
      </dl>
    </section>
  );
}

function BenchFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "primary" | "success";
}) {
  return (
    <div>
      <dt className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 font-serif text-xl font-light",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
