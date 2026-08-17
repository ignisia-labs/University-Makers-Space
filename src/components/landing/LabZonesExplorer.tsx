import { useState } from "react";
import {
  Box,
  CheckCircle,
  Cpu,
  Flame,
  HardHat,
  Laptop,
  Layers,
  Microchip,
  MoveRight,
  Printer,
  Radio,
  Scan,
  Shield,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import img3d from "@/assets/eq-3dprinter.jpg";
import imgLaser from "@/assets/eq-laser.jpg";
import imgElectronics from "@/assets/eq-electronics.jpg";
import imgRobotics from "@/assets/eq-robotics.jpg";
import imgWorkstation from "@/assets/eq-workstation.jpg";
import imgHero from "@/assets/hero-makerspace.jpg";

interface ZoneData {
  id: string;
  name: string;
  tag: string;
  badgeColor: string;
  icon: typeof Box;
  image: string;
  headline: string;
  description: string;
  equipment: string[];
  capabilities: string[];
  specs: { label: string; value: string }[];
}

const zones: ZoneData[] = [
  {
    id: "fabrication",
    name: "Digital Fabrication Zone",
    tag: "Zone 01 // Additive & Subtractive",
    badgeColor: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: Printer,
    image: img3d,
    headline: "Industrial-grade 3D printing & laser machining.",
    description:
      "A complete rapid prototyping cell for turning 3D CAD files into physical components with micrometer precision. Supports multi-material FDM, ultra-high resolution SLA resin, optical 3D surface scanning, and precision CO₂ laser cutting.",
    equipment: [
      "FDM 3D Printers (High-speed CoreXY)",
      "Dual Nozzle 3D Printer (Water-soluble supports)",
      "SLA Resin 3D Printer (50-micron detail)",
      "Structured-light 3D Scanner",
      "CO₂ Laser Cutter & Precision Engraver",
      "High-accuracy Vinyl & Film Cutter",
    ],
    capabilities: [
      "Rapid Part Iteration",
      "Enclosure Prototyping",
      "Reverse Engineering",
      "Sheet Material Profiling",
    ],
    specs: [
      { label: "Layer Resolution", value: "20 - 300 Microns" },
      { label: "Laser Cutting Power", value: "80W CO₂ Sealed Tube" },
      { label: "Scan Accuracy", value: "Up to 0.05 mm" },
      { label: "Materials", value: "PLA, PETG, ABS, Resin, Acrylic, Wood" },
    ],
  },
  {
    id: "electronics",
    name: "Electronics Workstation",
    tag: "Zone 02 // Test & Measurement",
    badgeColor: "bg-indigo-500/10 text-blue-600 border-indigo-500/20",
    icon: Cpu,
    image: imgElectronics,
    headline: "6 dedicated benches for circuit debugging & testing.",
    description:
      "Fully equipped electronics testing benches with calibrated digital storage oscilloscopes, true-RMS digital multimeters, variable linear power supplies, and temperature-controlled soldering & SMD hot air rework stations.",
    equipment: [
      "6 Independent Student Workstations",
      "Digital Storage Oscilloscopes (DSO 100MHz+)",
      "Digital Multimeters (DMM True-RMS)",
      "Dual-channel Regulated DC Power Supplies",
      "Lead-Free Soldering & SMD Hot Air Stations",
      "High-density Component & Resistor/Capacitor Storage",
    ],
    capabilities: [
      "Signal Waveform Analysis",
      "SMD Component Rework",
      "Power Integrity Testing",
      "PCB Assembly & Debugging",
    ],
    specs: [
      { label: "Bandwidth", value: "100 MHz Dual Channel" },
      { label: "Soldering Temp", value: "100°C - 480°C Digital PID" },
      { label: "Power Output", value: "0-30V / 0-5A Dual Track" },
      { label: "Storage Modules", value: "1,000+ Passive/Active Components" },
    ],
  },
  {
    id: "robotics",
    name: "Embedded Systems & Robotics",
    tag: "Zone 03 // Microcontrollers & Autonomous",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Microchip,
    image: imgRobotics,
    headline: "Microcontroller suites & robotic drive modules.",
    description:
      "Extensive hardware ecosystem for robotics, autonomous vehicles, and IoT prototypes. Includes complete Arduino, ESP32, and Raspberry Pi modules alongside sensor packages, motor drivers, servo actuators, and mobile chassis.",
    equipment: [
      "Arduino Uno, Mega & Nano Microcontroller Kits",
      "ESP32 & ESP8266 Wi-Fi / Bluetooth IoT Modules",
      "Raspberry Pi 4 / 5 Single Board Computers",
      "Sensor Suites (IMU, Ultrasonic, LIDAR, IR, Temp)",
      "Actuators (DC Geared, Stepper Motors, High-Torque Servos)",
      "Chassis Kits, Motor Drivers & Hardware Fastener Bins",
    ],
    capabilities: [
      "Autonomous Navigation",
      "IoT Cloud Telemetry",
      "Edge Machine Learning",
      "Motor & Actuator Control",
    ],
    specs: [
      { label: "Compute Platforms", value: "AVR, Xtensa 32-bit, ARM Cortex-A76" },
      { label: "Wireless Protocols", value: "Wi-Fi 6, BLE 5.0, LoRaWAN" },
      { label: "Sensors", value: "20+ Calibrated Sensor Types" },
      { label: "Storage System", value: "Color-coded Rapid Part Bins" },
    ],
  },
  {
    id: "collaboration",
    name: "Collaboration & Prototyping Tables",
    tag: "Zone 04 // Mechanical Assembly",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    icon: Users,
    image: imgWorkstation,
    headline: "Large shared worktables with integrated centralised power.",
    description:
      "Heavy-duty, spacious work surfaces designed for multi-student teamwork, large mechanism fitting, wire harness routing, and live troubleshooting. Features embedded power sockets, USB-C ports, and assembly clamps right at the center spine.",
    equipment: [
      "Large Heavy-duty Shared Work Tables",
      "Built-in Central Power Sockets & USB Fast Charging",
      "Benchtop Vices, Clamp Fixtures & Alignment Jigs",
      "Tool Organizers (Hex keys, pliers, wire strippers, cutters)",
      "High-durability Anti-static Surface Mats",
      "Ergonomic Swivel Work Stools",
    ],
    capabilities: [
      "Full Chassis Assembly",
      "Interdisciplinary Team Syncs",
      "Wire Harness Routing",
      "Pre-flight System Testing",
    ],
    specs: [
      { label: "Table Structure", value: "Solid Hardwood + Steel Frame" },
      { label: "Power Distribution", value: "Centralised Strip (AC & USB)" },
      { label: "Capacity", value: "Up to 24 Students Concurrently" },
      { label: "Surface Protection", value: "Heat & ESD Resistant Mats" },
    ],
  },
  {
    id: "cad",
    name: "Design & CAD Corner",
    tag: "Zone 05 // Modeling & Simulation",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    icon: Laptop,
    image: imgLaser,
    headline: "High-performance CAD workstations & simulation displays.",
    description:
      "Dedicated digital engineering station with multi-core GPU computing, ultra-wide color-accurate displays, and digital graphic tablets for industrial styling, finite element analysis (FEA), computational fluid dynamics (CFD), and PCB layout design.",
    equipment: [
      "2 High-Performance CAD Workstations with Dedicated GPUs",
      "Large 4K Ultra-Sharp Display Monitors",
      "Precision Pressure-sensitive Graphic Tablets",
      "Licensed Engineering CAD & CAM Suites",
      "KiCad & Eagle PCB Schematic Suites",
      "3D Slicing & Laser Pathing Terminals",
    ],
    capabilities: [
      "3D Parametric CAD Modeling",
      "FEA Stress & Thermal Simulation",
      "Multi-layer PCB Routing",
      "Industrial Surface Styling",
    ],
    specs: [
      { label: "Software Suites", value: "SolidWorks, Fusion 360, KiCad, Cura" },
      { label: "Displays", value: "High-DPI Color-calibrated Monitors" },
      { label: "Input Devices", value: "Pressure-sensitive Stylus Tablets" },
      { label: "CAM Integration", value: "Direct G-code Export to Lab Machines" },
    ],
  },
  {
    id: "safety",
    name: "Safety & Infrastructure",
    tag: "Zone 06 // Environmental Safety",
    badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    icon: Shield,
    image: imgHero,
    headline: "Active ventilation, first aid & certified fire protection.",
    description:
      "Uncompromising safety infrastructure engineered to maintain pristine lab conditions during intensive thermal cutting and soldering operations. Outfitted with wall-mounted active fume extractors, PPE safety stations, and accessible emergency shut-offs.",
    equipment: [
      "Wall-Mounted Active Fume Extractor System",
      "CO₂ & ABC Dry Chemical Fire Extinguishers",
      "Fully Stocked Industrial First Aid Kit",
      "Comprehensive PPE Storage (Safety goggles, ESD straps, heat gloves)",
      "Emergency Power Cutoff Switches",
      "Chemical Spill Clean-up & Waste Segregation Bins",
    ],
    capabilities: [
      "Air Quality & Fume Filtration",
      "Thermal & Electrical Isolation",
      "Rapid First Aid Response",
      "Standardised Lab Protocol Compliance",
    ],
    specs: [
      { label: "Ventilation", value: "High-CFM Wall-Mounted Fume Extraction" },
      { label: "Fire Safety", value: "Certified Multi-Class Extinguishers" },
      { label: "PPE Standard", value: "ANSI Z87.1 Impact Eye Protection" },
      { label: "Electrical Safety", value: "ELCB / MCB Protected Circuitry" },
    ],
  },
];

export function LabZonesExplorer() {
  const [activeZoneId, setActiveZoneId] = useState("fabrication");
  const activeZone = zones.find((z) => z.id === activeZoneId) || zones[0];

  return (
    <section id="zones" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-background scroll-mt-20">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Layers className="size-3.5" />
            <span>Interactive Floor Plan & Zones</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Six dedicated zones. <br />
            <span className="text-primary">Infinite engineering possibilities.</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
            The MIT-WPU MakerSpace floor plan is organized into 6 purpose-built zones to eliminate
            bottlenecks, prevent cross-interference, and maximize prototyping throughput.
          </p>
        </div>

        {/* Zone Selector Pill Tabs */}
        <div className="flex items-center justify-start lg:justify-center gap-2 overflow-x-auto pb-4 no-scrollbar">
          {zones.map((zone) => {
            const Icon = zone.icon;
            const isSelected = zone.id === activeZoneId;
            return (
              <button
                key={zone.id}
                onClick={() => setActiveZoneId(zone.id)}
                className={`group flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/30 scale-105"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                <Icon
                  className={`size-4 ${isSelected ? "text-primary-foreground" : "text-primary"}`}
                />
                <span>{zone.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active Zone Detail Showcase Card */}
        <div className="mt-8 rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xl transition-all duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Left Column: Details, Equipment list & Specs */}
            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
              <div>
                {/* Zone Tag & Badge */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider ${activeZone.badgeColor}`}
                  >
                    <Sparkles className="size-3" />
                    {activeZone.tag}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground/70">
                    LAB ZONE // {activeZone.id.toUpperCase()}
                  </span>
                </div>

                {/* Headline & Description */}
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {activeZone.headline}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {activeZone.description}
                </p>

                {/* Equipment Checklist */}
                <div className="mt-8">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Wrench className="size-3.5 text-primary" />
                    Installed Hardware & Equipment
                  </h4>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeZone.equipment.map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/60 p-2.5 text-xs font-medium text-foreground"
                      >
                        <CheckCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Capabilities Badges */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Zap className="size-3.5 text-amber-500" />
                    Key Prototyping Capabilities
                  </h4>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {activeZone.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Technical Specifications Bar */}
              <div className="mt-8 pt-6 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {activeZone.specs.map((spec) => (
                  <div key={spec.label} className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {spec.label}
                    </span>
                    <span className="mt-1 text-xs font-bold font-mono text-foreground">
                      {spec.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Zone High-Resolution Visual Representation */}
            <div className="lg:col-span-5 relative min-h-[320px] lg:min-h-full bg-slate-950 overflow-hidden flex flex-col justify-end p-6 sm:p-8">
              <img
                src={activeZone.image}
                alt={activeZone.name}
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              {/* Floating Overlay Badge on the Image */}
              <div className="relative z-10 rounded-2xl border border-white/20 bg-black/60 backdrop-blur-md p-4 text-white shadow-2xl">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    ZONE READY FOR BOOKING
                  </span>
                  <span>MIT-WPU</span>
                </div>
                <p className="mt-2 text-sm font-bold text-white">{activeZone.name}</p>
                <p className="text-xs text-slate-300">
                  Available for semester capstones, student clubs, and faculty-guided projects.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
