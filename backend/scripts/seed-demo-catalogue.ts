/**
 * Demonstration catalogue: five domains spanning the branches a MakerSpace
 * actually serves, and enough equipment in each to make them look inhabited.
 *
 * ── Read this before running it ──────────────────────────────────────────────
 *
 * Most of the equipment this creates DOES NOT EXIST. It is here so the domain
 * browser, project kit picker and admin screens can be demonstrated without
 * waiting for a real inventory of every discipline.
 *
 * That is the same mistake an earlier seed made: it invented a printer and a
 * spool of filament, they read as real, and students selected them on projects
 * and held them for bookings before anyone noticed nobody had bought them. So
 * every fabricated row is marked — its description ends with DEMO_MARKER — and
 * `--remove` deletes exactly those rows and nothing else.
 *
 * Real equipment imported from the MakerSpace's own sheets is never touched
 * except to file it under a domain.
 *
 *   npx tsx scripts/seed-demo-catalogue.ts            # preview
 *   npx tsx scripts/seed-demo-catalogue.ts --commit   # apply
 *   npx tsx scripts/seed-demo-catalogue.ts --remove   # delete every demo row
 */
import "dotenv/config";
import { prisma } from "../src/config/db.js";

const COMMIT = process.argv.includes("--commit");
const REMOVE = process.argv.includes("--remove");

/** Every fabricated row carries this, so removal is exact rather than by name. */
const DEMO_MARKER = "[demo item — not part of the audited inventory]";

type DemoItem = {
  name: string;
  category: string;
  description: string;
  specs: string[];
  quantity: number;
};

type DemoDomain = {
  name: string;
  tagline: string;
  /** Which disciplines this serves — shown to no one, kept here as rationale. */
  serves: string;
  items: DemoItem[];
};

const DOMAINS: DemoDomain[] = [
  {
    name: "Digital Fabrication",
    tagline: "Print, cut & shape",
    serves: "Mechanical, Design, Civil",
    items: [
      {
        name: "FDM 3D Printer",
        category: "3D Printing",
        description: "Large-format fused-deposition printer for functional prototypes.",
        specs: ["350 × 350 × 400 mm", "PLA / PETG / TPU", "0.4 mm nozzle"],
        quantity: 4,
      },
      {
        name: "Resin 3D Printer",
        category: "3D Printing",
        description: "Stereolithography printer for fine-detail parts and moulds.",
        specs: ["143 × 89 × 175 mm", "50 micron layers", "Standard / tough resin"],
        quantity: 2,
      },
      {
        name: "CO2 Laser Cutter",
        category: "Laser & CNC",
        description: "Sheet cutting and engraving for acrylic, MDF and plywood.",
        specs: ["60 W tube", "600 × 400 mm bed", "Extraction required"],
        quantity: 1,
      },
      {
        name: "Desktop CNC Router",
        category: "Laser & CNC",
        description: "Three-axis router for wood, acrylic and soft aluminium.",
        specs: ["300 × 180 × 45 mm travel", "GRBL control", "Eye protection required"],
        quantity: 1,
      },
      {
        name: "Vinyl Cutter",
        category: "Laser & CNC",
        description: "Contour cutting for decals, stencils and flexible circuits.",
        specs: ["630 mm width", "Roll or sheet feed"],
        quantity: 1,
      },
      {
        name: "Handheld 3D Scanner",
        category: "Fabrication Support",
        description: "Captures physical parts as meshes for reverse engineering.",
        specs: ["0.1 mm accuracy", "USB-C tethered"],
        quantity: 1,
      },
    ],
  },
  {
    name: "Electronics & Embedded",
    tagline: "Solder, measure & debug",
    serves: "Electronics & Telecommunication, Computer, Instrumentation",
    items: [
      {
        name: "Digital Storage Oscilloscope",
        category: "Test & Measurement",
        description: "Four-channel scope for timing, signal integrity and debugging.",
        specs: ["100 MHz", "4 channels", "1 GSa/s"],
        quantity: 3,
      },
      {
        name: "Function Generator",
        category: "Test & Measurement",
        description: "Arbitrary waveform source for stimulus and filter testing.",
        specs: ["25 MHz", "2 channels", "Sine / square / arbitrary"],
        quantity: 2,
      },
      {
        name: "Bench Power Supply",
        category: "Test & Measurement",
        description: "Adjustable regulated supply with current limiting.",
        specs: ["0–30 V", "0–5 A", "Dual channel"],
        quantity: 4,
      },
      {
        name: "Digital Multimeter",
        category: "Test & Measurement",
        description: "Bench meter for voltage, current, resistance and continuity.",
        specs: ["6000 count", "True RMS", "CAT III 600 V"],
        quantity: 6,
      },
      {
        name: "Logic Analyser",
        category: "Test & Measurement",
        description: "Captures parallel and serial buses for protocol debugging.",
        specs: ["8 channels", "24 MHz", "I2C / SPI / UART decode"],
        quantity: 2,
      },
      {
        name: "Soldering Station",
        category: "Soldering & Rework",
        description: "Temperature-controlled iron for through-hole and surface mount.",
        specs: ["Temperature controlled", "ESD safe", "Fume extraction nearby"],
        quantity: 6,
      },
      {
        name: "Hot Air Rework Station",
        category: "Soldering & Rework",
        description: "Hot-air tool for removing and reflowing surface-mount packages.",
        specs: ["100–480 °C", "Multiple nozzles"],
        quantity: 2,
      },
    ],
  },
  {
    name: "Robotics & Automation",
    tagline: "Sense, actuate & move",
    serves: "Mechatronics, Robotics, Mechanical",
    items: [
      {
        name: "Six-Axis Robotic Arm Trainer",
        category: "Robotics Platforms",
        description: "Desktop articulated arm for pick-and-place and path programming.",
        specs: ["6 degrees of freedom", "500 g payload", "Python / ROS"],
        quantity: 1,
      },
      {
        name: "Mobile Robot Chassis",
        category: "Robotics Platforms",
        description: "Differential-drive platform for navigation and line following.",
        specs: ["Two-wheel drive", "Encoder feedback", "Arduino / Pi compatible"],
        quantity: 4,
      },
      {
        name: "Quadcopter Development Kit",
        category: "Robotics Platforms",
        description: "Assembly and flight-controller kit for aerial robotics coursework.",
        specs: ["450 mm frame", "Flight controller", "Indoor cage required"],
        quantity: 2,
      },
      {
        name: "PLC Training Panel",
        category: "Industrial Control",
        description: "Ladder-logic trainer with switches, lamps and relay outputs.",
        specs: ["Digital and analogue I/O", "Ladder logic", "24 V industrial"],
        quantity: 2,
      },
      {
        name: "Conveyor Automation Rig",
        category: "Industrial Control",
        description: "Belt conveyor with sensors for sorting and counting exercises.",
        specs: ["Variable speed", "Optical sensors", "PLC or microcontroller driven"],
        quantity: 1,
      },
    ],
  },
  {
    name: "Design & Simulation",
    tagline: "Model, render & analyse",
    serves: "Design, Architecture, and every branch doing CAD or FEA",
    items: [
      {
        name: "CAD Workstation",
        category: "Workstations",
        description: "High-memory workstation for modelling, simulation and rendering.",
        specs: ["32 GB RAM", "Discrete GPU", "CAD / CAM / FEA suite"],
        quantity: 6,
      },
      {
        name: "VR Headset",
        category: "Workstations",
        description: "Design review and walkthrough of models at full scale.",
        specs: ["6DoF tracking", "Tethered", "Clear play area required"],
        quantity: 2,
      },
      {
        name: "Graphics Tablet",
        category: "Workstations",
        description: "Pen input for sketching, texturing and annotation.",
        specs: ["Pressure sensitive", "A4 active area"],
        quantity: 4,
      },
      {
        name: "Large-Format Plotter",
        category: "Imaging & Display",
        description: "Prints drawings, posters and full-size templates.",
        specs: ["A1 width", "Roll feed"],
        quantity: 1,
      },
      {
        name: "Colour-Calibrated Display",
        category: "Imaging & Display",
        description: "Reference monitor for colour-critical design work.",
        specs: ["27 inch", "Factory calibrated", "sRGB / AdobeRGB"],
        quantity: 2,
      },
    ],
  },
  {
    name: "Workshop & Materials",
    tagline: "Cut, join & finish",
    serves: "Mechanical, Civil, Production",
    items: [
      {
        name: "Bench Drill Press",
        category: "Power Tools",
        description: "Accurate vertical drilling for metal, wood and acrylic.",
        specs: ["13 mm chuck", "Variable speed", "Eye protection required"],
        quantity: 1,
      },
      {
        name: "Bandsaw",
        category: "Power Tools",
        description: "Curved and straight cuts in timber and soft metals.",
        specs: ["200 mm throat", "Induction motor", "Supervision required"],
        quantity: 1,
      },
      {
        name: "Angle Grinder",
        category: "Power Tools",
        description: "Cutting and finishing metal stock.",
        specs: ["115 mm disc", "Face shield required"],
        quantity: 2,
      },
      {
        name: "Rotary Tool Kit",
        category: "Hand Tools",
        description: "Fine grinding, sanding and polishing of small parts.",
        specs: ["Variable speed", "Accessory set", "Flexible shaft"],
        quantity: 3,
      },
      {
        name: "Bench Vice Station",
        category: "Hand Tools",
        description: "Fixed workbench vice for holding and filing work.",
        specs: ["125 mm jaws", "Bolted to bench"],
        quantity: 4,
      },
      {
        name: "Hand Tool Set",
        category: "Hand Tools",
        description: "Spanners, screwdrivers, pliers and measuring tools.",
        specs: ["Metric", "Shadow board", "Sign out at the desk"],
        quantity: 5,
      },
    ],
  },
];

/**
 * Where each real, imported machine belongs once there are five domains.
 * First match wins, so specific rules come before general ones.
 */
const REAL_PLACEMENT: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /sensor|hc-?sr04|am2302|ds18b20|\bdht\b|flying-?fish|proximity/i, domain: "Robotics & Automation" },
  { pattern: /servo|stepper|dc motor|motor driver|speed control|relay/i, domain: "Robotics & Automation" },
  { pattern: /plc|microcontroller based/i, domain: "Robotics & Automation" },
  { pattern: /arduino|bread-?board|solder|display|\blcd\b|driver|cable/i, domain: "Electronics & Embedded" },
];
const REAL_FALLBACK = "Electronics & Embedded";

async function main() {
  const lab = await prisma.lab.findFirstOrThrow({ where: { isActive: true } });

  if (REMOVE) {
    const doomed = await prisma.equipment.findMany({
      where: { labId: lab.id, description: { contains: DEMO_MARKER } },
      select: { id: true, name: true },
    });
    if (!COMMIT) {
      console.log(`Would delete ${doomed.length} demo rows:`);
      for (const item of doomed) console.log(`  ${item.name}`);
      console.log("\nRe-run with --remove --commit to apply.");
      return;
    }
    const ids = doomed.map((item) => item.id);
    // Demo rows should never have been booked, but check rather than assume:
    // a failed delete is better than a silently rewritten booking.
    const held = await prisma.bookingEquipment.count({ where: { equipmentId: { in: ids } } });
    const planned = await prisma.projectEquipmentRequirement.count({
      where: { equipmentId: { in: ids } },
    });
    if (held || planned) {
      console.error(
        `Refusing to delete: ${held} booking holds and ${planned} project requirements reference these rows. Clear those first.`,
      );
      process.exitCode = 1;
      return;
    }
    await prisma.equipment.deleteMany({ where: { id: { in: ids } } });
    console.log(JSON.stringify({ removed: doomed.length }));
    return;
  }

  const realEquipment = await prisma.equipment.findMany({
    where: { labId: lab.id, deletedAt: null, description: { not: { contains: DEMO_MARKER } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!COMMIT) {
    console.log("DOMAINS\n");
    for (const domain of DOMAINS) {
      const real = realEquipment.filter(
        (item) =>
          (REAL_PLACEMENT.find((rule) => rule.pattern.test(item.name))?.domain ?? REAL_FALLBACK) ===
          domain.name,
      );
      console.log(`${domain.name} — ${domain.tagline}`);
      console.log(`  serves: ${domain.serves}`);
      console.log(`  ${domain.items.length} demo machines, ${real.length} real machines`);
      for (const item of domain.items) {
        console.log(`    + ${item.quantity} × ${item.name}  (${item.category})`);
      }
      for (const item of real) console.log(`      · ${item.name}`);
      console.log("");
    }
    const total = DOMAINS.reduce((sum, domain) => sum + domain.items.length, 0);
    console.log(`${total} demo machines would be created, ${realEquipment.length} real ones refiled.`);
    console.log("Preview only. Re-run with --commit.");
    return;
  }

  // ── Domains ────────────────────────────────────────────────────────────────
  const domainIds = new Map<string, string>();
  for (const [index, domain] of DOMAINS.entries()) {
    const row = await prisma.domain.upsert({
      where: { labId_name: { labId: lab.id, name: domain.name } },
      update: { tagline: domain.tagline, sortOrder: index, isActive: true },
      create: { labId: lab.id, name: domain.name, tagline: domain.tagline, sortOrder: index },
    });
    domainIds.set(domain.name, row.id);
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const categoryIds = new Map<string, string>();
  const categoryNames = new Set(DOMAINS.flatMap((d) => d.items.map((i) => i.category)));
  for (const name of categoryNames) {
    const row = await prisma.equipmentCategory.upsert({
      where: { labId_name: { labId: lab.id, name } },
      update: { isActive: true },
      create: { labId: lab.id, name },
    });
    categoryIds.set(name, row.id);
  }

  // ── Demo equipment ─────────────────────────────────────────────────────────
  let created = 0;
  for (const domain of DOMAINS) {
    for (const item of domain.items) {
      await prisma.equipment.upsert({
        where: { labId_name: { labId: lab.id, name: item.name } },
        update: {
          categoryId: categoryIds.get(item.category)!,
          domainId: domainIds.get(domain.name)!,
          description: `${item.description} ${DEMO_MARKER}`,
          specs: item.specs,
          totalQuantity: item.quantity,
        },
        create: {
          labId: lab.id,
          categoryId: categoryIds.get(item.category)!,
          domainId: domainIds.get(domain.name)!,
          name: item.name,
          description: `${item.description} ${DEMO_MARKER}`,
          specs: item.specs,
          totalQuantity: item.quantity,
          availableQuantity: item.quantity,
        },
      });
      created += 1;
    }
  }

  // ── Refile the real equipment ──────────────────────────────────────────────
  let refiled = 0;
  for (const item of realEquipment) {
    const domain = REAL_PLACEMENT.find((rule) => rule.pattern.test(item.name))?.domain ?? REAL_FALLBACK;
    await prisma.equipment.update({
      where: { id: item.id },
      data: { domainId: domainIds.get(domain)! },
    });
    refiled += 1;
  }

  // Materials stay with the bench work they are used for.
  const consumables = await prisma.consumable.updateMany({
    where: { labId: lab.id },
    data: { domainId: domainIds.get("Electronics & Embedded")! },
  });

  // Domains from earlier rounds that nothing belongs to any more.
  const stale = await prisma.domain.findMany({
    where: {
      labId: lab.id,
      name: { notIn: DOMAINS.map((d) => d.name) },
      equipment: { none: {} },
      consumables: { none: {} },
    },
    select: { id: true, name: true },
  });
  if (stale.length) {
    await prisma.domain.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  }

  console.log(
    JSON.stringify({
      domains: DOMAINS.map((d) => d.name),
      demoEquipmentCreated: created,
      realEquipmentRefiled: refiled,
      consumablesRefiled: consumables.count,
      staleDomainsRemoved: stale.map((row) => row.name),
    }),
  );
}

main().finally(() => prisma.$disconnect());
