/**
 * Arrange the catalogue into the MakerSpace's domains.
 *
 * Domains are how a student meets the catalogue, so they follow the space's own
 * zones rather than the spreadsheets the stock came from. Everything imported
 * from the JN007/JN110/JN305 sheets is electronics work, which splits naturally
 * in two: parts you solder and measure, and parts that sense, actuate or move.
 * The other zones are created empty — an empty domain is honest, and filling it
 * with the wrong machines to look complete would not be.
 *
 * Run:  npx tsx scripts/organise-domains.ts [--commit]
 */
import "dotenv/config";
import { prisma } from "../src/config/db.js";

const COMMIT = process.argv.includes("--commit");

/** The zones the MakerSpace advertises, in the order a student meets them. */
const DOMAINS = [
  { name: "Digital Fabrication", tagline: "Print, cut & shape" },
  { name: "Electronics", tagline: "Solder, measure & test" },
  { name: "Embedded & Robotics", tagline: "Sense, actuate & move" },
  { name: "Design & CAD", tagline: "Model & simulate" },
];

/**
 * Which zone a machine belongs to.
 *
 * Ordered: the first match wins, so the specific rules come before the general
 * ones. A relay *module* is something a board switches, while a bare relay is a
 * component — the import already made that call, and this only sorts what it
 * classified as equipment.
 */
const PLACEMENT: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /arduino|plc programmer|microcontroller/i, domain: "Embedded & Robotics" },
  {
    pattern: /sensor|hc-?sr04|am2302|ds18b20|\bdht\b|flying-?fish|proximity/i,
    domain: "Embedded & Robotics",
  },
  { pattern: /servo|stepper|dc motor|motor driver|speed control/i, domain: "Embedded & Robotics" },
  { pattern: /relay/i, domain: "Embedded & Robotics" },
  { pattern: /bread-?board|solder|display|\blcd\b|driver|cable/i, domain: "Electronics" },
];

/** Anything the sheets left unplaced still belongs on a bench. */
const FALLBACK = "Electronics";

async function main() {
  const lab = await prisma.lab.findFirstOrThrow({ where: { isActive: true } });

  const equipment = await prisma.equipment.findMany({
    where: { labId: lab.id, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const placement = new Map<string, string[]>();
  for (const item of equipment) {
    const rule = PLACEMENT.find((entry) => entry.pattern.test(item.name));
    const domain = rule?.domain ?? FALLBACK;
    placement.set(domain, [...(placement.get(domain) ?? []), item.name]);
  }

  if (!COMMIT) {
    console.log("Domains to exist:", DOMAINS.map((d) => d.name).join(", "));
    for (const domain of DOMAINS) {
      const items = placement.get(domain.name) ?? [];
      console.log(`\n=== ${domain.name} (${items.length} machines) ===`);
      for (const name of items) console.log(`  ${name}`);
      if (items.length === 0) console.log("  (empty — nothing in the catalogue fits here yet)");
    }
    console.log("\nAll consumables go to Electronics: they are soldered, not driven.");
    console.log("\nPreview only. Re-run with --commit.");
    return;
  }

  const domainIds = new Map<string, string>();
  for (const [index, domain] of DOMAINS.entries()) {
    const row = await prisma.domain.upsert({
      where: { labId_name: { labId: lab.id, name: domain.name } },
      update: { tagline: domain.tagline, sortOrder: index, isActive: true },
      create: { labId: lab.id, name: domain.name, tagline: domain.tagline, sortOrder: index },
    });
    domainIds.set(domain.name, row.id);
  }

  for (const item of equipment) {
    const rule = PLACEMENT.find((entry) => entry.pattern.test(item.name));
    await prisma.equipment.update({
      where: { id: item.id },
      data: { domainId: domainIds.get(rule?.domain ?? FALLBACK)! },
    });
  }

  const consumables = await prisma.consumable.updateMany({
    where: { labId: lab.id },
    data: { domainId: domainIds.get("Electronics")! },
  });

  // Domains created during earlier verification that nothing belongs to are
  // removed: an empty *zone* is meaningful, an empty leftover is clutter.
  const stale = await prisma.domain.findMany({
    where: {
      labId: lab.id,
      name: { notIn: DOMAINS.map((domain) => domain.name) },
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
      domains: DOMAINS.map((domain) => ({
        name: domain.name,
        machines: (placement.get(domain.name) ?? []).length,
      })),
      consumablesPlaced: consumables.count,
      staleDomainsRemoved: stale.map((row) => row.name),
    }),
  );
}

main().finally(() => prisma.$disconnect());
