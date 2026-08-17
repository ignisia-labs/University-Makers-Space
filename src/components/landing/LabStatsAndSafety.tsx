import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Flame,
  HardHat,
  HeartPulse,
  ShieldCheck,
  Wind,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const safetyProtocols = [
  {
    icon: Wind,
    title: "Wall-Mounted Fume Extraction",
    desc: "Dedicated high-flow exhaust hoods capturing airborne particulates and fumes during soldering and laser operations.",
  },
  {
    icon: HardHat,
    title: "Mandatory PPE & Eye Protection",
    desc: "ANSI-certified impact safety goggles, ESD wrist straps, and thermal heat gloves provided at every active workstation.",
  },
  {
    icon: Flame,
    title: "Multi-Class Fire Suppression",
    desc: "Strategically positioned CO₂ and Dry Chemical extinguishers with clear emergency egress paths and quick shutoffs.",
  },
  {
    icon: HeartPulse,
    title: "Certified First Aid Station",
    desc: "Fully stocked industrial first aid kit for minor burns, cuts, and rapid laboratory emergency assistance.",
  },
];

const labStats = [
  { value: "6", label: "Specialised Lab Zones", detail: "Dedicated for zero cross-interference" },
  {
    value: "15+",
    label: "Advanced Prototyping Machines",
    detail: "3D Printers, Laser, Oscilloscopes & CAD",
  },
  {
    value: "24",
    label: "Concurrent Student Capacity",
    detail: "Large shared tables with centralised power",
  },
  {
    value: "100%",
    label: "Hands-On Prototyping Focus",
    detail: "Designed directly for student engineering",
  },
];

export function LabStatsAndSafety() {
  return (
    <section
      id="safety"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-slate-950 text-white scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl">
        {/* Statistics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pb-16 border-b border-white/10">
          {labStats.map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-primary-foreground tracking-tight">
                {stat.value}
              </div>
              <div className="mt-2 text-sm font-bold text-white">{stat.label}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.detail}</div>
            </div>
          ))}
        </div>

        {/* Safety Section */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Heading & Description */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="size-3.5" />
              <span>Safety & Environmental Standards</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              A secure, ventilated space for confident experimentation.
            </h2>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Safety is fundamental to innovation. The MIT-WPU MakerSpace adheres to strict
              industrial workshop guidelines, ensuring students explore hardware prototyping in a
              safe, monitored, and thoroughly ventilated environment.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <span>Read Lab Safety Guidelines</span>
              </Link>
            </div>
          </div>

          {/* Right Column: 4 Safety Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {safetyProtocols.map((protocol) => {
              const Icon = protocol.icon;
              return (
                <div
                  key={protocol.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 text-primary-foreground mb-4">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{protocol.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{protocol.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
