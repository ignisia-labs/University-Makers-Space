import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "info" | "muted";

const toneClass: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  info: "bg-info/12 text-info border-info/30",
  muted: "bg-muted text-muted-foreground border-border",
};

const map: Record<string, Tone> = {
  Verified: "success",
  Available: "success",
  Active: "success",
  "Team Acceptance Pending": "warning",
  "Mentor Approval Pending": "warning",
  "Under Maintenance": "warning",
  Rejected: "warning",
  Cancelled: "muted",
  "No Show": "warning",
  "Partially Available": "info",
  "In Use": "info",
  Reserved: "info",
  Unavailable: "warning",
  Damaged: "warning",
  "Out of Service": "warning",
  Draft: "muted",
  Completed: "muted",
  "Quick Visit": "info",
  "Project Slot": "info",
};

export function StatusBadge({ label, className }: { label: string; className?: string }) {
  const tone = map[label] ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
