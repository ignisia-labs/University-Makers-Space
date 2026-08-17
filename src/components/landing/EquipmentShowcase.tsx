import { useState } from "react";
import {
  Activity,
  Box,
  Cpu,
  Layers,
  Monitor,
  Printer,
  Radio,
  Scan,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";

import img3d from "@/assets/eq-3dprinter.jpg";
import imgLaser from "@/assets/eq-laser.jpg";
import imgElectronics from "@/assets/eq-electronics.jpg";
import imgRobotics from "@/assets/eq-robotics.jpg";
import imgWorkstation from "@/assets/eq-workstation.jpg";

interface EquipmentItem {
  id: string;
  category: "all" | "fabrication" | "electronics" | "robotics" | "cad";
  name: string;
  categoryLabel: string;
  image: string;
  description: string;
  specs: { label: string; value: string }[];
  tags: string[];
}

const equipmentList: EquipmentItem[] = [
  {
    id: "fdm-printers",
    category: "fabrication",
    categoryLabel: "Digital Fabrication",
    name: "CoreXY FDM 3D Printers",
    image: img3d,
    description:
      "High-speed fused deposition modeling printers with heated chambers and direct-drive extruders for engineering filaments.",
    specs: [
      { label: "Build Volume", value: "300 x 300 x 350 mm" },
      { label: "Nozzle Temp", value: "Up to 300°C" },
      { label: "Compatible Filaments", value: "PLA, PETG, ABS, TPU, Carbon-Fiber" },
    ],
    tags: ["Rapid Prototyping", "Multi-Material", "0.1mm Accuracy"],
  },
  {
    id: "laser-cutter",
    category: "fabrication",
    categoryLabel: "Digital Fabrication",
    name: "80W CO₂ Laser Cutter & Engraver",
    image: imgLaser,
    description:
      "Precision CNC optical cutting machine for clean sheet profiling, engraving, and rapid acrylic enclosure assembly.",
    specs: [
      { label: "Laser Power", value: "80W Sealed CO₂" },
      { label: "Bed Dimensions", value: "900 x 600 mm" },
      { label: "Cut Thickness", value: "Up to 10mm Acrylic / Wood" },
    ],
    tags: ["Vector Cutting", "Raster Engraving", "High Speed"],
  },
  {
    id: "oscilloscopes",
    category: "electronics",
    categoryLabel: "Electronics & Test",
    name: "Digital Storage Oscilloscopes (DSO)",
    image: imgElectronics,
    description:
      "Multi-channel digital oscilloscopes with real-time waveform decoding for analog, digital, and bus signal integrity.",
    specs: [
      { label: "Bandwidth", value: "100 MHz Real-Time" },
      { label: "Sampling Rate", value: "1 GSa/s" },
      { label: "Channels", value: "4 Analog Channels + Math" },
    ],
    tags: ["Waveform Capture", "I2C/SPI Decode", "FFT Analysis"],
  },
  {
    id: "embedded-robotics",
    category: "robotics",
    categoryLabel: "Robotics & IoT",
    name: "Autonomous Robotics & IoT Suites",
    image: imgRobotics,
    description:
      "Full ecosystem of microcontrollers, brushless motor drivers, IMU sensor kits, and single board computers.",
    specs: [
      { label: "Processors", value: "ESP32, RP2040, Pi 4/5" },
      { label: "Sensors Included", value: "Ultrasonic, LIDAR, Gyro, IR" },
      { label: "Actuators", value: "Encoders, Steppers, Servos" },
    ],
    tags: ["Autonomous Control", "Edge AI", "ROS Compatible"],
  },
  {
    id: "cad-stations",
    category: "cad",
    categoryLabel: "CAD & Simulation",
    name: "GPU-Accelerated CAD Workstations",
    image: imgWorkstation,
    description:
      "High-spec workstations with dedicated workstation GPUs, dual 4K monitors, and pressure-sensitive stylus tablets.",
    specs: [
      { label: "Software", value: "SolidWorks, Fusion 360, KiCad" },
      { label: "Graphics", value: "NVIDIA RTX Dedicated GPU" },
      { label: "Peripherals", value: "Wacom Graphic Tablet + 4K Display" },
    ],
    tags: ["Parametric Modeling", "FEA/CFD", "PCB Layout"],
  },
  {
    id: "soldering-stations",
    category: "electronics",
    categoryLabel: "Electronics & Test",
    name: "SMD Soldering & Hot Air Rework Benches",
    image: imgElectronics,
    description:
      "Micro-soldering tools with temperature PID feedback, hot-air pencils, and ESD-safe grounding mats.",
    specs: [
      { label: "Temperature Range", value: "100°C – 480°C" },
      { label: "Airflow Rate", value: "120 L/min Max" },
      { label: "Protection", value: "Full ESD-Safe Grounded" },
    ],
    tags: ["Surface Mount", "Desoldering", "Lead-Free"],
  },
];

const categories = [
  { id: "all", label: "All Equipment", icon: Layers },
  { id: "fabrication", label: "Digital Fabrication", icon: Printer },
  { id: "electronics", label: "Electronics & Test", icon: Cpu },
  { id: "robotics", label: "Robotics & IoT", icon: Radio },
  { id: "cad", label: "CAD & Simulation", icon: Monitor },
];

export function EquipmentShowcase() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredItems = equipmentList.filter((item) =>
    selectedCategory === "all" ? true : item.category === selectedCategory,
  );

  return (
    <section
      id="equipment"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border/60 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Wrench className="size-3.5" />
              <span>Lab Machinery & Tools</span>
            </div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Industrial tools ready for your projects.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
            All equipment is maintained, calibrated, and supervised by trained lab staff to ensure
            flawless execution for your academic and startup builds.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-foreground text-background shadow-md"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-card/80"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Equipment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Image Container with tag */}
              <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-950">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
                    {item.categoryLabel}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-base font-bold text-white drop-shadow-md">{item.name}</h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

                {/* Specs List */}
                <div className="mt-4 pt-4 border-t border-border/60 space-y-1.5">
                  {item.specs.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">{spec.label}</span>
                      <span className="font-semibold font-mono text-foreground text-[11px]">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="mt-5 flex flex-wrap gap-1.5 pt-3 border-t border-border/40">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
