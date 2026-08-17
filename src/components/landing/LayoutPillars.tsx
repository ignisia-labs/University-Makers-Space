import { CheckCircle2, LayoutGrid, Maximize2, ShieldCheck, Users, Zap } from "lucide-react";

const pillars = [
  {
    icon: Maximize2,
    title: "Spacious Layout",
    desc: "Ample open floor space facilitating fluid physical movement, cross-table collaboration, and large-scale assembly.",
    tag: "Open Architecture",
    accent: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    gradient: "from-indigo-500/10 to-transparent",
  },
  {
    icon: Zap,
    title: "Centralised Power",
    desc: "Built-in high-current power sockets and rapid USB charging ports integrated along center spines of all tables.",
    tag: "Embedded Hubs",
    accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    gradient: "from-amber-500/10 to-transparent",
  },
  {
    icon: LayoutGrid,
    title: "Zoned Setup",
    desc: "Distinct dedicated zones for fabrication, soldering, CAD, and robotics with clear perimeter visibility.",
    tag: "6 Dedicated Sectors",
    accent: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    gradient: "from-indigo-500/10 to-transparent",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Efficient",
    desc: "Active wall-mounted fume extraction, dual fire suppression, first-aid stations, and strict PPE safety protocols.",
    tag: "Safety Compliant",
    accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    gradient: "from-emerald-500/10 to-transparent",
  },
  {
    icon: Users,
    title: "Student-Centric",
    desc: "Designed ground-up for hands-on experiential learning, rapid prototyping sprints, and multidisciplinary teams.",
    tag: "100% Hands-On",
    accent: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    gradient: "from-cyan-500/10 to-transparent",
  },
];

export function LayoutPillars() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/20">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-12 border-b border-border/40">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <CheckCircle2 className="size-3.5" />
              <span>Lab Architecture & Philosophy</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
              Engineered for seamless physical prototyping.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
            Every square foot of the MIT-WPU MakerSpace is optimized for engineering velocity,
            electrical safety, and frictionless interdisciplinary teamwork.
          </p>
        </div>

        {/* 5 Pillars Grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
          {pillars.map(({ icon: Icon, title, desc, tag, accent, gradient }) => (
            <div
              key={title}
              className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Subtle top gradient glow on hover */}
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity`}
              />

              <div>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex size-11 items-center justify-center rounded-xl border ${accent} transition-transform group-hover:scale-110`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                    {tag}
                  </span>
                </div>

                <h3 className="mt-5 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>

              {/* Bottom technical index marker */}
              <div className="mt-6 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
                <span>SPEC // OK</span>
                <span className="group-hover:text-primary transition-colors">✦ ACTIVE</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
