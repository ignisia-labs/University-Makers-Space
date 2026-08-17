import {
  ArrowRight,
  Boxes,
  Cpu,
  Lightbulb,
  Rocket,
  Sparkles,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const tracks = [
  {
    icon: Wrench,
    title: "Prototype Development",
    subtitle: "Rapid Proof-of-Concept Builds",
    desc: "Transform computer models into tangible mechanical and electronic prototypes within hours using our FDM, SLA, and CO₂ laser cells.",
    features: [
      "Rapid iterative revision cycles",
      "Functional enclosure & fit testing",
      "Structural durability verification",
      "Direct BOM material estimation",
    ],
    badge: "Track 01",
    accent: "border-indigo-500/20 bg-indigo-500/5 text-blue-600",
  },
  {
    icon: Cpu,
    title: "Mini Projects & Coursework",
    subtitle: "Curriculum & Academic Builds",
    desc: "Dedicated lab slots for undergraduate and postgraduate engineering courses, capstone projects, and thesis hardware development.",
    features: [
      "Calibrated test bench access",
      "Component library & inventory",
      "Guided safety supervision",
      "Faculty review slot verification",
    ],
    badge: "Track 02",
    accent: "border-indigo-500/20 bg-indigo-500/5 text-indigo-600",
  },
  {
    icon: Users,
    title: "Interdisciplinary Projects",
    subtitle: "Cross-Department Collaboration",
    desc: "A shared innovation ecosystem where Mechanical, Computer Science, Robotics, and Design students collaborate on cohesive multidisciplinary solutions.",
    features: [
      "Large shared assembly worktables",
      "Centralised power & team space",
      "Shared multidisciplinary inventory",
      "Cross-domain design workshops",
    ],
    badge: "Track 03",
    accent: "border-purple-500/20 bg-purple-500/5 text-purple-600",
  },
  {
    icon: Rocket,
    title: "Startups & Innovation",
    subtitle: "Venture Incubation & Hackathons",
    desc: "Empowering student founders with industrial-grade tools to develop minimum viable physical products (MVPs) for grants and venture competitions.",
    features: [
      "Production-grade tooling",
      "Hardware demo preparation",
      "Hackathon build acceleration",
      "Incubation support alignment",
    ],
    badge: "Track 04",
    accent: "border-amber-500/20 bg-amber-500/5 text-amber-600",
  },
];

export function InnovationTracks() {
  return (
    <section id="tracks" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-background scroll-mt-20">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Target className="size-3.5" />
            <span>Built For Student Innovation</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            What will you build at MakerSpace?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
            From first-year coursework mini-projects to full-fledged startup hardware prototypes,
            our facilities are tailored for every stage of your engineering journey.
          </p>
        </div>

        {/* 4 Tracks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tracks.map((track) => {
            const Icon = track.icon;
            return (
              <div
                key={track.title}
                className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1"
              >
                <div>
                  {/* Top Badge & Icon */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${track.accent}`}
                    >
                      {track.badge}
                    </span>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="size-5" />
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-xs font-semibold text-primary/80 mt-0.5">{track.subtitle}</p>

                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{track.desc}</p>

                  {/* Features List */}
                  <div className="mt-5 pt-4 border-t border-border/60 space-y-2">
                    {track.features.map((feat) => (
                      <div
                        key={feat}
                        className="flex items-center gap-2 text-[11px] text-foreground/90"
                      >
                        <span className="size-1.5 rounded-full bg-primary shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA Link */}
                <div className="mt-6 pt-4 border-t border-border/40">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline"
                  >
                    <span>Start Project</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
