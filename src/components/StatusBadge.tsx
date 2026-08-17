import {
  Archive,
  BadgeCheck,
  Ban,
  BookMarked,
  CheckCircle2,
  CircleDot,
  Clock3,
  PackageCheck,
  ShieldCheck,
  type LucideIcon,
  UserRound,
  UsersRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant =
  "success" | "pending" | "active" | "maintenance" | "danger" | "neutral" | "role";

type BadgeDefinition = { variant: StatusBadgeVariant; icon: LucideIcon };

const definitions: Record<string, BadgeDefinition> = {
  Verified: { variant: "success", icon: CheckCircle2 },
  Available: { variant: "success", icon: CheckCircle2 },
  Approved: { variant: "success", icon: CheckCircle2 },
  Accepted: { variant: "success", icon: CheckCircle2 },
  Completed: { variant: "success", icon: CheckCircle2 },
  Entered: { variant: "success", icon: CheckCircle2 },
  Active: { variant: "active", icon: CircleDot },
  "In Use": { variant: "active", icon: CircleDot },
  Reserved: { variant: "active", icon: BookMarked },
  Confirmed: { variant: "active", icon: BookMarked },
  "Project Slot": { variant: "active", icon: BookMarked },
  "Quick Visit": { variant: "active", icon: BookMarked },
  Draft: { variant: "neutral", icon: PackageCheck },
  Archived: { variant: "neutral", icon: Archive },
  Cancelled: { variant: "neutral", icon: Ban },
  Inactive: { variant: "neutral", icon: Ban },
  Exited: { variant: "neutral", icon: Clock3 },
  Expected: { variant: "neutral", icon: Clock3 },
  Pending: { variant: "pending", icon: Clock3 },
  Requested: { variant: "pending", icon: Clock3 },
  "Team Acceptance Pending": { variant: "pending", icon: Clock3 },
  "Mentor Approval Pending": { variant: "pending", icon: Clock3 },
  "Awaiting review": { variant: "pending", icon: Clock3 },
  "No Show": { variant: "danger", icon: XCircle },
  "No-Show": { variant: "danger", icon: XCircle },
  Rejected: { variant: "danger", icon: XCircle },
  Unavailable: { variant: "danger", icon: Ban },
  Damaged: { variant: "danger", icon: XCircle },
  "Out of Service": { variant: "danger", icon: Ban },
  "Under Maintenance": { variant: "maintenance", icon: Wrench },
  "Partially Available": { variant: "maintenance", icon: Wrench },
  Student: { variant: "role", icon: UserRound },
  "Faculty Mentor": { variant: "role", icon: UsersRound },
  "Lab Assistant": { variant: "role", icon: ShieldCheck },
  Admin: { variant: "role", icon: ShieldCheck },
  "Super Admin": { variant: "role", icon: BadgeCheck },
  Leader: { variant: "role", icon: UserRound },
  Saved: { variant: "success", icon: CheckCircle2 },
  Published: { variant: "success", icon: CheckCircle2 },
  Full: { variant: "danger", icon: Ban },
};

const variantClasses: Record<StatusBadgeVariant, string> = {
  success:
    "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400",
  pending:
    "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400",
  active:
    "border-indigo-200/70 bg-indigo-50 text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-400",
  maintenance:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  danger:
    "border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-400",
  neutral: "border-border bg-muted/70 text-muted-foreground",
  role: "border-primary/15 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10",
};

export function StatusBadge({
  label,
  variant,
  className,
}: {
  label: string;
  variant?: StatusBadgeVariant;
  className?: string;
}) {
  const definition = definitions[label];
  const tone = variant ?? definition?.variant ?? "neutral";
  const Icon = definition?.icon ?? PackageCheck;

  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-tight",
        variantClasses[tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
