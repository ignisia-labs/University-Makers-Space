import { cn } from "@/lib/utils";

/** Ignisia logomark — five nodes, drawn in the current text colour. */
export function IgnisiaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="11" y="2" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="6.5" y="6.5" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="2" y="11" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="11" y="11" width="5" height="5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function IgnisiaCredit({ className }: { className?: string }) {
  return (
    <a
      href="https://ignisia.tech"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group inline-flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      <IgnisiaMark className="size-4 text-primary/70 transition-colors group-hover:text-primary" />
      <span className="text-[10px] font-mono uppercase tracking-widest">
        An <span className="font-semibold text-foreground/70">Ignisia</span> project
      </span>
    </a>
  );
}
