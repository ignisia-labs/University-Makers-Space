import { useEffect, useRef, useState } from "react";

const steps = [
  "Create your project",
  "Build your team",
  "Choose a Faculty Mentor",
  "Identify required resources",
  "Get your project verified",
  "Book a MakerSpace slot",
  "Visit and build",
];

const STEP_SCROLL_HEIGHT = 120; // px of scroll per step

export function GuidedJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      // How far user has scrolled into the sticky section
      const scrolled = -rect.top;
      const totalScrollRange = rect.height - window.innerHeight;

      if (scrolled <= 0) {
        setActiveIndex(0);
        return;
      }
      if (scrolled >= totalScrollRange) {
        setActiveIndex(steps.length - 1);
        return;
      }

      const idx = Math.min(
        steps.length - 1,
        Math.floor(scrolled / STEP_SCROLL_HEIGHT)
      );
      setActiveIndex(idx);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Total section height = viewport height + steps × scroll-per-step
  const sectionHeight = `calc(100vh + ${steps.length * STEP_SCROLL_HEIGHT}px)`;

  return (
    <div
      ref={sectionRef}
      className="relative border-y border-border bg-card"
      style={{ height: sectionHeight }}
    >
      {/* Sticky inner: always fills viewport while user scrolls through */}
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">

            {/* ── LEFT: Heading ──────────────────────────────────── */}
            <div className="lg:w-[42%] shrink-0">
              {/* Left-edge vertical tracker */}
              <div className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 flex-col items-center gap-1">
                <span className="text-foreground font-bold text-sm tabular-nums leading-none">
                  {activeIndex + 1}
                </span>
                <span className="text-muted-foreground/40 text-[10px]">/</span>
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {steps.length}
                </span>
                <div className="mt-2 flex flex-col gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-0.5 rounded-full transition-all duration-400 ${
                        i === activeIndex
                          ? "h-5 bg-primary"
                          : i < activeIndex
                          ? "h-3 bg-primary/35"
                          : "h-3 bg-border"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Heading block */}
              <span className="text-xs font-bold text-primary tracking-widest uppercase">
                One guided journey
              </span>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl lg:text-4xl leading-tight text-foreground">
                From an idea to time in the MakerSpace.
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground max-w-sm">
                The platform carries project context forward, so your team does
                not have to repeatedly provide information the university already
                knows.
              </p>
            </div>

            {/* ── RIGHT: Step cards (no inner scroll) ───────────── */}
            <div className="lg:w-[58%] flex flex-col gap-3">
              <ol className="space-y-3">
                {steps.map((step, index) => {
                  const distance = Math.abs(index - activeIndex);
                  const isActive = index === activeIndex;
                  const isPast = index < activeIndex;

                  // Stronger blur & fade on inactive cards
                  const blurPx =
                    distance === 0 ? 0 : distance === 1 ? 2.5 : distance * 4;
                  const opacity =
                    distance === 0
                      ? 1
                      : distance === 1
                      ? 0.38
                      : Math.max(0.05, 0.22 - distance * 0.06);
                  // Active card scales UP, others scale down more aggressively
                  const scale = isActive
                    ? 1.04
                    : Math.max(0.91, 1 - distance * 0.03);

                  return (
                    <li
                      key={step}
                      ref={(el) => { cardRefs.current[index] = el; }}
                      className={`flex items-center gap-5 rounded-2xl border px-7 py-5 select-none
                        ${
                          isActive
                            ? "border-primary/40 bg-background shadow-xl ring-2 ring-primary/20"
                            : isPast
                            ? "border-border bg-background/70"
                            : "border-border/60 bg-background/40"
                        }`}
                      style={{
                        filter: `blur(${blurPx}px)`,
                        opacity,
                        transform: `scale(${scale})`,
                        transition:
                          "filter 0.45s ease, opacity 0.45s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease",
                        boxShadow: isActive
                          ? "0 8px 40px -8px oklch(var(--primary) / 0.18), 0 2px 12px -2px oklch(var(--primary) / 0.1)"
                          : undefined,
                      }}
                    >
                      {/* Number bubble — larger on active */}
                      <span
                        className={`grid shrink-0 place-items-center rounded-full font-bold transition-all duration-300 ${
                          isActive
                            ? "size-11 text-sm bg-primary text-primary-foreground shadow-md"
                            : isPast
                            ? "size-9 text-xs bg-primary/15 text-primary"
                            : "size-9 text-xs bg-accent text-accent-foreground"
                        }`}
                      >
                        {isPast ? (
                          <svg
                            className="size-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </span>

                      {/* Step label — larger & bolder on active */}
                      <span
                        className={`font-semibold transition-all duration-300 ${
                          isActive
                            ? "text-base text-foreground"
                            : "text-sm text-muted-foreground"
                        }`}
                      >
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
