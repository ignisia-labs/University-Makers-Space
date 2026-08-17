import {
  Printer,
  Cpu,
  Wrench,
  Boxes,
  ScanLine,
  Bot,
  Ruler,
  Monitor,
  Zap,
  FlaskConical,
  Layers,
  Settings2,
} from "lucide-react";
import { useEffect, useRef } from "react";

const resources = [
  {
    icon: Printer,
    title: "Additive Manufacturing",
    body: "FDM and resin 3D printers for rapid prototyping and part production.",
    accent: "bg-blue-50 text-blue-600",
  },
  {
    icon: ScanLine,
    title: "Laser Fabrication",
    body: "Laser cutters and engravers for precision sheet and surface work.",
    accent: "bg-violet-50 text-violet-600",
  },
  {
    icon: Settings2,
    title: "CNC Machining",
    body: "Computer-controlled milling and routing for mechanical parts.",
    accent: "bg-orange-50 text-orange-600",
  },
  {
    icon: Cpu,
    title: "Electronics & IoT",
    body: "Develop connected prototypes with electronics and embedded resources.",
    accent: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: Bot,
    title: "Robotics",
    body: "Build, test and refine robotic systems for engineering projects.",
    accent: "bg-rose-50 text-rose-600",
  },
  {
    icon: Wrench,
    title: "Mechanical Tools",
    body: "Hand tools, power tools and workbenches for fabrication and assembly.",
    accent: "bg-amber-50 text-amber-600",
  },
  {
    icon: Ruler,
    title: "Measurement & Testing",
    body: "Oscilloscopes, multimeters and calibrated measurement equipment.",
    accent: "bg-teal-50 text-teal-600",
  },
  {
    icon: Monitor,
    title: "CAD Workstations",
    body: "High-performance stations for 3D modelling and simulation work.",
    accent: "bg-sky-50 text-sky-600",
  },
  {
    icon: Zap,
    title: "AI / GPU Computing",
    body: "GPU-accelerated workstations for AI, ML and compute-heavy projects.",
    accent: "bg-purple-50 text-purple-600",
  },
  {
    icon: FlaskConical,
    title: "Soldering & Assembly",
    body: "Precision soldering stations and SMD rework tools for PCB work.",
    accent: "bg-green-50 text-green-600",
  },
  {
    icon: Boxes,
    title: "Project Workbenches",
    body: "Dedicated benches for ongoing build, test and iterate cycles.",
    accent: "bg-cyan-50 text-cyan-600",
  },
  {
    icon: Layers,
    title: "Consumables",
    body: "Filament, wire, board stock and materials for your project builds.",
    accent: "bg-pink-50 text-pink-600",
  },
];

// Duplicate list for seamless infinite loop
const track = [...resources, ...resources];

export function ResourcesCarousel() {
  const animRef = useRef<HTMLDivElement>(null);

  // Pause on hover
  const pause = () => {
    if (animRef.current) animRef.current.style.animationPlayState = "paused";
  };
  const resume = () => {
    if (animRef.current) animRef.current.style.animationPlayState = "running";
  };

  return (
    <section className="py-14 overflow-hidden">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-10">
        <p className="text-sm font-semibold text-primary">Made for hands-on work</p>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Explore the resources your project needs.
          </h2>
          <p className="text-sm leading-6 text-muted-foreground max-w-sm">
            MakerSpace resources are configured by the university.
            Availability is shown when you plan your project and book a visit.
          </p>
        </div>
      </div>

      {/* Left + right fade masks */}
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent" />

        {/* Marquee track */}
        <div
          ref={animRef}
          onMouseEnter={pause}
          onMouseLeave={resume}
          className="flex gap-5 w-max"
          style={{
            animation: "marquee-scroll 40s linear infinite",
          }}
        >
          {track.map(({ icon: Icon, title, body, accent }, i) => (
            <article
              key={`${title}-${i}`}
              className="shrink-0 w-64 flex flex-col rounded-2xl border border-border bg-background p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default select-none"
            >
              <span className={`grid size-10 place-items-center rounded-xl ${accent}`}>
                <Icon className="size-4.5" />
              </span>
              <h3 className="mt-4 text-sm font-bold leading-snug text-foreground">{title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
