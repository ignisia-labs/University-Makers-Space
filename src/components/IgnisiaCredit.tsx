import { cn } from "@/lib/utils";

/** Ignisia molecular logomark — teal linked nodes, matching the brand mark. */
export function IgnisiaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("shrink-0", className)} aria-hidden>
      {/* connectors */}
      <path
        d="M11 8.5 L16 12 M22 7 L17 11.5 M9 17 L13.5 20 M21 16.5 L17 20 M15 24 L15 21"
        stroke="#2CC5B0"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* nodes */}
      <rect x="3" y="11" width="9" height="9" rx="2.5" fill="#63D7C7" />
      <rect x="8" y="3" width="6" height="6" rx="1.8" fill="#2CC5B0" />
      <rect x="19" y="3.5" width="6.5" height="6.5" rx="2" fill="#8FE3D7" />
      <rect x="13" y="12.5" width="7" height="7" rx="2" fill="#2CC5B0" opacity="0.85" />
      <rect x="21" y="13" width="5.5" height="5.5" rx="1.7" fill="#63D7C7" />
      <rect x="11.5" y="22" width="6.5" height="6.5" rx="2" fill="#2CC5B0" />
    </svg>
  );
}

/** Ignisia wordmark — script lettering with the brand's blue → purple gradient. */
export function IgnisiaWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-[#1E3AA8] via-[#4338CA] to-[#7C3AED] bg-clip-text font-serif text-lg font-semibold italic tracking-wide text-transparent",
        className,
      )}
    >
      Ignisia
    </span>
  );
}

export function IgnisiaCredit({ className }: { className?: string }) {
  return (
    <a
      href="https://ignisia.tech"
      target="_blank"
      rel="noreferrer"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="An Ignisia project — think, build, evolve"
    >
      <IgnisiaMark className="size-6 transition-transform duration-300 group-hover:scale-110" />
      <span className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          an
        </span>
        <IgnisiaWordmark />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          project
        </span>
      </span>
    </a>
  );
}
