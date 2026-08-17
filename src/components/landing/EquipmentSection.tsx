import img3d from "@/assets/eq-3dprinter.jpg";
import imgLaser from "@/assets/eq-laser.jpg";
import imgElectronics from "@/assets/eq-electronics.jpg";
import imgRobotics from "@/assets/eq-robotics.jpg";
import imgWorkstation from "@/assets/eq-workstation.jpg";

const domains = [
  {
    name: "Digital Fabrication",
    subtitle: "Additive & Subtractive Prototyping",
    image: img3d,
    provided: [
      "CoreXY high-speed 3D printers",
      "SLA resin 3D printer for 50-micron detail",
      "80W CO₂ laser cutter & engraver",
      "Structured-light 3D scanner & vinyl cutter",
    ],
  },
  {
    name: "Electronics & Testing",
    subtitle: "Signal Analysis & PCB Assembly",
    image: imgElectronics,
    provided: [
      "6 fully equipped student test benches",
      "100MHz Digital Storage Oscilloscopes",
      "DC regulated variable power supplies",
      "Lead-free soldering & PID hot air rework",
    ],
  },
  {
    name: "Embedded Systems & IoT",
    subtitle: "Robotics & Microcontrollers",
    image: imgRobotics,
    provided: [
      "Arduino, ESP32 & Raspberry Pi kits",
      "Sensor suites (IMU, LIDAR, Ultrasonic)",
      "Brushless motor drivers & servo actuators",
      "Rapid prototyping component organizer bins",
    ],
  },
  {
    name: "Design & Simulation",
    subtitle: "CAD Corner & Modeling Rigs",
    image: imgLaser, // Elegant placeholder from assets
    provided: [
      "GPU-accelerated CAD workstations",
      "SolidWorks, Fusion 360 & KiCad environments",
      "Large 4K ultra-sharp monitors",
      "Wacom pressure-sensitive graphic tablets",
    ],
  },
  {
    name: "Workspaces & Safety",
    subtitle: "Assembly & Air Quality Control",
    image: imgWorkstation,
    provided: [
      "Heavy-duty tables with centralised power spines",
      "Wall-mounted high-flow active fume extractors",
      "Full PPE gear (safety goggles, ESD mats, gloves)",
      "First aid and multi-class fire suppression",
    ],
  },
];

export function EquipmentSection() {
  return (
    <section className="relative w-full bg-white py-24 px-6 md:px-12 border-t border-zinc-200/50">
      <div className="mx-auto max-w-5xl">
        {/* Section Header */}
        <div className="mb-20">
          <p className="text-[10px] font-mono tracking-widest text-[#1E2B8A] uppercase font-semibold">
            02 // DOMAINS & LAB RESOURCES
          </p>
          <h2 className="mt-2 text-4xl sm:text-5xl font-serif font-light text-[#0F172A] tracking-wide">
            Available Lab Domains
          </h2>
          <p className="mt-3 text-xs sm:text-sm tracking-wider text-zinc-400 max-w-xl leading-relaxed font-mono uppercase">
            What is provided to students for prototyping.
          </p>
        </div>

        {/* Minimal Graphic-Heavy Domains Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {domains.map((domain, index) => (
            <div key={index} className="flex flex-col gap-6">
              {/* Photo Container */}
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-zinc-200 bg-[#F0EFFF] shadow-sm">
                <img
                  src={domain.image}
                  alt={domain.name}
                  className="w-full h-full object-cover opacity-95 transition-transform duration-700 hover:scale-103"
                />

                {/* Visual indicator of the domain index */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-200">
                  <span className="font-mono text-[9px] text-[#1E2B8A] font-semibold">
                    SYS_{String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              </div>

              {/* Text & Offerings */}
              <div>
                <h3 className="text-xl font-serif font-medium text-[#0F172A] tracking-tight">
                  {domain.name}
                </h3>
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">
                  {domain.subtitle}
                </p>

                {/* What is provided (Bullet list style) */}
                <ul className="mt-4 space-y-2">
                  {domain.provided.map((item, itemIdx) => (
                    <li
                      key={itemIdx}
                      className="flex items-start gap-2 text-xs text-zinc-500 leading-normal"
                    >
                      <span className="size-1 bg-[#1E2B8A] rounded-full shrink-0 mt-2" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
