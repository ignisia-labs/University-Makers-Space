import img3d from "@/assets/eq-3dprinter.jpg";
import imgElectronics from "@/assets/eq-electronics.jpg";
import imgRobotics from "@/assets/eq-robotics.jpg";
import imgWorkstation from "@/assets/eq-workstation.jpg";

export type DomainEquipment = {
  name: string;
  spec: string;
};

export type DomainConsumable = {
  name: string;
  unit: string;
  variants: string[];
  max: number;
};

export type ResourceDomain = {
  id: string;
  name: string;
  tagline: string;
  image: string;
  equipment: DomainEquipment[];
  consumables: DomainConsumable[];
};

export type ConsumableSelection = {
  name: string;
  variant: string;
  qty: number;
};

export type ResourceKit = {
  equipment: string[];
  consumables: ConsumableSelection[];
};

export const emptyKit: ResourceKit = { equipment: [], consumables: [] };

export const resourceDomains: ResourceDomain[] = [
  {
    id: "fabrication",
    name: "Digital Fabrication",
    tagline: "Print, cut & shape",
    image: img3d,
    equipment: [
      { name: "FDM 3D Printer", spec: "350 × 350 × 400 mm · PLA / PETG / TPU" },
      { name: "Resin 3D Printer", spec: "SLA · 50-micron detail" },
      { name: "CO2 Laser Cutter", spec: "60 W · acrylic, MDF, ply" },
    ],
    consumables: [
      {
        name: "PLA Filament",
        unit: "spool",
        variants: ["1.75 mm · White", "1.75 mm · Black", "1.75 mm · Grey"],
        max: 3,
      },
      {
        name: "Acrylic Sheets",
        unit: "sheet",
        variants: ["3 mm · Clear", "3 mm · Black", "5 mm · Clear"],
        max: 5,
      },
      { name: "MDF Board", unit: "board", variants: ["3 mm", "6 mm"], max: 4 },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    tagline: "Solder, measure & test",
    image: imgElectronics,
    equipment: [
      { name: "Soldering Station", spec: "Hakko FX-888D · lead-free" },
      { name: "Oscilloscope", spec: "100 MHz DSO · 2 channels" },
    ],
    consumables: [
      { name: "PCB Blanks", unit: "board", variants: ["Single-sided", "Double-sided"], max: 6 },
      { name: "Jumper Wires", unit: "pack", variants: ["M–M", "M–F", "F–F"], max: 4 },
    ],
  },
  {
    id: "embedded",
    name: "Embedded & Robotics",
    tagline: "Sense, actuate & move",
    image: imgRobotics,
    equipment: [
      { name: "ESP32 Kit", spec: "Wi-Fi + BLE dev board · sensor bundle" },
      { name: "Ultrasonic Sensor", spec: "HC-SR04 · 2–400 cm ranging" },
      { name: "Robotic Arm", spec: "4-axis · 500 g payload" },
    ],
    consumables: [],
  },
  {
    id: "design",
    name: "Design & CAD",
    tagline: "Model & simulate",
    image: imgWorkstation,
    equipment: [{ name: "CAD Workstation", spec: "i7 / 32 GB / RTX · SolidWorks, Fusion 360" }],
    consumables: [],
  },
];

export function formatConsumable(selection: ConsumableSelection) {
  return `${selection.name} (${selection.variant}) × ${selection.qty}`;
}

export function parseConsumable(value: string): ConsumableSelection | null {
  const match = value.match(/^(.+?) \((.+)\) × (\d+)$/);
  if (!match) return null;
  return { name: match[1]!, variant: match[2]!, qty: Number(match[3]) };
}

export function kitFromProject(resources: string[], consumables: string[]): ResourceKit {
  return {
    equipment: [...resources],
    consumables: consumables
      .map(parseConsumable)
      .filter((item): item is ConsumableSelection => item !== null),
  };
}
