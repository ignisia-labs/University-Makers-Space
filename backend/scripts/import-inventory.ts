/**
 * One-off onboarding of the MakerSpace's existing stock rooms.
 *
 * The source sheets are room inventories (JN007, JN110, JN305) with an item, a
 * specification and a count. Two decisions turn that into this app's model:
 *
 *  1. **Equipment or consumable.** Equipment is *issued and returned* — a board,
 *     a module, a sensor, a tool. A consumable is *spent* — a resistor soldered
 *     into a project does not come back. That distinction is what the booking
 *     and claim flows are built on, so it has to be made per item rather than
 *     per sheet.
 *
 *  2. **The name carries the specification.** "Resistor" appears dozens of times
 *     with different values, and both tables are unique on (lab, name). A bare
 *     "Resistor" would collapse them all into one row, so the value is part of
 *     the name and the room is recorded in the description.
 *
 * Rows describing the same thing — within a sheet or across sheets — are merged
 * and their counts summed, because two drawers of 470 Ω resistors are one line
 * in a catalogue.
 *
 * Run a preview:   npx tsx scripts/import-inventory.ts
 * Apply it:        npx tsx scripts/import-inventory.ts --commit
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "../src/config/db.js";

const COMMIT = process.argv.includes("--commit");

const SOURCES = [
  { file: "/Users/vivaanmathur/Downloads/Jn007.xlsx", room: "JN007" },
  { file: "/Users/vivaanmathur/Downloads/jn110_components_updated (1).xlsx", room: "JN110" },
  { file: "/Users/vivaanmathur/Downloads/JN305_components_from_pdf.xlsx", room: "JN305" },
];

/**
 * Items that are handed out and come back.
 *
 * Matched on the item name only — a specification never decides this, because
 * "Arduino Uno, 5 V" is still a board and "Resistor, 5 V rated" is still spent.
 */
const EQUIPMENT_RULES: Array<{ pattern: RegExp; category: string }> = [
  {
    pattern: /\barduino\b|\bplc programmer\b|microcontroller based/i,
    category: "Development Boards",
  },
  {
    pattern: /sensor|hc-?sr04|am2302|ds18b20|\bdht\b|flying-?fish|proximity/i,
    category: "Sensors",
  },
  {
    pattern: /servo|stepper motor|dc motor|motor driver|speed control/i,
    category: "Motors & Actuators",
  },
  { pattern: /relay module|\bdriver\b|\bmodule\b/i, category: "Modules & Drivers" },
  { pattern: /display module|lcd/i, category: "Displays" },
  { pattern: /bread-?board|soldering stand/i, category: "Prototyping Tools" },
  { pattern: /vga cable|\bcable\b/i, category: "Cables & Connectors" },
];

/** Everything else is stock that gets used up; this only picks the shelf it sits on. */
const CONSUMABLE_RULES: Array<{ pattern: RegExp; category: string }> = [
  {
    pattern: /resistor|potentiometer|trimpot|trimmer|wire wound|pankaj pot/i,
    category: "Resistors",
  },
  { pattern: /capacitor|polyster|polyester/i, category: "Capacitors" },
  {
    pattern: /diode|zener|transistor|rectifier|\btr\.|crystal|oscillator/i,
    category: "Semiconductors",
  },
  { pattern: /\bic\b|timer ic|uln|l293d/i, category: "Integrated Circuits" },
  { pattern: /\bled\b|7[- ]segment|buzzer/i, category: "LEDs & Indicators" },
  { pattern: /solder|wick|wire|bundle/i, category: "Wire & Solder" },
  {
    pattern:
      /switch|button|connector|header|jumper|terminal block|\brelay\b|\bjst\b|\bbnc\b|\bd\.m\./i,
    category: "Switches & Connectors",
  },
  { pattern: /fuse|transformer|cooling fan/i, category: "Power & Protection" },
  { pattern: /screw|component/i, category: "Hardware" },
];

type Item = {
  name: string;
  description: string;
  specs: string[];
  quantity: number;
  /** What the sheet counted in — "1 Bundle", "3 STRIP" — not always a piece. */
  unit: string;
  /** Verbatim quantity cells, kept so an unreadable count can be traced back. */
  rawQuantities: string[];
  category: string;
  kind: "equipment" | "consumable";
  rooms: Set<string>;
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as unknown as Record<string, unknown>;
    if (Array.isArray(record["richText"])) {
      return (record["richText"] as Array<{ text: string }>).map((part) => part.text).join("");
    }
    if ("text" in record) return String(record["text"]);
    if ("result" in record) return String(record["result"]);
  }
  return String(value);
}

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * The count, and what it counts.
 *
 * The sheets write "1 Bundle" and "3 STRIP" as well as plain numbers. A blank
 * becomes zero rather than a guessed one: an item nobody counted should show as
 * unstocked and be corrected, not silently invented.
 */
function parseQuantity(raw: string): { quantity: number; unit: string } {
  const match = raw.match(/\d+(?:\.\d+)?/);
  const quantity = match ? Math.max(0, Math.round(Number(match[0]))) : 0;
  const word = raw
    .replace(/[\d.,]/g, "")
    .trim()
    .toLowerCase();
  const unit = word && word.length <= 12 ? word.replace(/s$/, "") : "piece";
  return { quantity, unit };
}

function classify(item: string): { kind: Item["kind"]; category: string } {
  for (const rule of EQUIPMENT_RULES) {
    if (rule.pattern.test(item)) return { kind: "equipment", category: rule.category };
  }
  for (const rule of CONSUMABLE_RULES) {
    if (rule.pattern.test(item)) return { kind: "consumable", category: rule.category };
  }
  // Unmatched items are treated as stock: mis-filing a board as a consumable is
  // visible and correctable, whereas an item silently dropped is not.
  return { kind: "consumable", category: "Uncategorised" };
}

/** The catalogue name: the item, plus its specification when there is one. */
function displayName(item: string, spec: string) {
  if (!spec) return item;
  if (item.toLowerCase().includes(spec.toLowerCase())) return item;
  return `${item} · ${spec}`;
}

async function read(): Promise<Map<string, Item>> {
  const merged = new Map<string, Item>();
  for (const source of SOURCES) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(source.file);
    const sheet = workbook.worksheets[0]!;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const item = clean(cellText(row.getCell(2).value));
      if (!item) continue;
      const spec = clean(cellText(row.getCell(3).value));
      const rawQuantity = cellText(row.getCell(4).value);
      const { quantity, unit } = parseQuantity(rawQuantity);
      const name = displayName(item, spec).slice(0, 120);
      const key = name.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.rooms.add(source.room);
        existing.rawQuantities.push(rawQuantity);
        continue;
      }
      const { kind, category } = classify(item);
      merged.set(key, {
        name,
        description: "",
        specs: spec ? [spec] : [],
        quantity,
        unit,
        rawQuantities: [rawQuantity],
        category,
        kind,
        rooms: new Set([source.room]),
      });
    }
  }
  for (const entry of merged.values()) {
    entry.description = `Held in ${[...entry.rooms].sort().join(", ")}.`;
  }
  return merged;
}

async function main() {
  const items = await read();
  const equipment = [...items.values()].filter((item) => item.kind === "equipment");
  const consumables = [...items.values()].filter((item) => item.kind === "consumable");

  if (!COMMIT) {
    const summarise = (rows: Item[], label: string) => {
      console.log(`\n=== ${label} (${rows.length}) ===`);
      const byCategory = new Map<string, Item[]>();
      for (const row of rows) {
        byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);
      }
      for (const [category, group] of [...byCategory.entries()].sort()) {
        console.log(`  ${category} (${group.length})`);
        for (const row of group.slice(0, 60)) {
          console.log(
            `    ${String(row.quantity).padStart(4)} × ${row.name}  [${[...row.rooms].join(",")}]`,
          );
        }
      }
    };
    summarise(equipment, "EQUIPMENT — issued and returned");
    summarise(consumables, "CONSUMABLES — spent, never returned");

    // Anything the sheets could not answer is surfaced rather than guessed at.
    const unknownCount = [...items.values()].filter((item) => item.quantity === 0);
    const unfiled = [...items.values()].filter((item) => item.category === "Uncategorised");
    const nearDuplicates = new Map<string, Item[]>();
    for (const item of items.values()) {
      // Decimal points must survive, or "1.2 Ω" and "12 Ω" look identical and
      // the warning cries wolf on every resistor value in the sheet.
      const key = item.name.toLowerCase().replace(/[^a-z0-9.]/g, "");
      nearDuplicates.set(key, [...(nearDuplicates.get(key) ?? []), item]);
    }
    const collisions = [...nearDuplicates.values()].filter((group) => group.length > 1);

    console.log("\n=== NEEDS A HUMAN ===");
    console.log(`  No quantity in the sheet (${unknownCount.length}) — imported as zero:`);
    for (const item of unknownCount) console.log(`    ${item.name} [${[...item.rooms].join(",")}]`);
    console.log(`  Could not be filed (${unfiled.length}):`);
    for (const item of unfiled) console.log(`    ${item.name} [${[...item.rooms].join(",")}]`);
    console.log(`  Possibly the same thing written twice (${collisions.length}):`);
    for (const group of collisions)
      console.log(`    ${group.map((item) => item.name).join("  |  ")}`);
    console.log(
      `\nPreview only. ${items.size} catalogue entries from ${SOURCES.length} sheets. Re-run with --commit to write.`,
    );
    return;
  }

  const lab = await prisma.lab.findFirstOrThrow({ where: { isActive: true } });
  const domain = await prisma.domain.upsert({
    where: { labId_name: { labId: lab.id, name: "Electronics" } },
    update: {},
    create: { labId: lab.id, name: "Electronics", tagline: "Solder, test & debug" },
  });

  const equipmentCategories = new Map<string, string>();
  for (const name of new Set(equipment.map((item) => item.category))) {
    const row = await prisma.equipmentCategory.upsert({
      where: { labId_name: { labId: lab.id, name } },
      update: { isActive: true },
      create: { labId: lab.id, name },
    });
    equipmentCategories.set(name, row.id);
  }
  const consumableCategories = new Map<string, string>();
  for (const name of new Set(consumables.map((item) => item.category))) {
    const row = await prisma.consumableCategory.upsert({
      where: { labId_name: { labId: lab.id, name } },
      update: { isActive: true },
      create: { labId: lab.id, name },
    });
    consumableCategories.set(name, row.id);
  }

  let equipmentWritten = 0;
  for (const item of equipment) {
    await prisma.equipment.upsert({
      where: { labId_name: { labId: lab.id, name: item.name } },
      // Quantities are re-stated from the sheet, but a machine already taken out
      // of service stays that way — the import is a stock count, not a repair.
      update: {
        categoryId: equipmentCategories.get(item.category)!,
        domainId: domain.id,
        description: item.description,
        specs: item.specs,
        totalQuantity: item.quantity,
      },
      create: {
        labId: lab.id,
        categoryId: equipmentCategories.get(item.category)!,
        domainId: domain.id,
        name: item.name,
        description: item.description,
        specs: item.specs,
        totalQuantity: item.quantity,
        availableQuantity: item.quantity,
      },
    });
    equipmentWritten += 1;
  }

  let consumablesWritten = 0;
  for (const item of consumables) {
    await prisma.consumable.upsert({
      where: { labId_name: { labId: lab.id, name: item.name } },
      update: {
        categoryId: consumableCategories.get(item.category)!,
        domainId: domain.id,
        description: item.description,
        stockQuantity: item.quantity,
      },
      create: {
        labId: lab.id,
        categoryId: consumableCategories.get(item.category)!,
        domainId: domain.id,
        name: item.name,
        unit: item.unit,
        description: item.description,
        stockQuantity: item.quantity,
        lowStockThreshold: 5,
      },
    });
    consumablesWritten += 1;
  }

  console.log(
    JSON.stringify({
      lab: lab.name,
      domain: domain.name,
      equipmentWritten,
      consumablesWritten,
      equipmentCategories: [...equipmentCategories.keys()],
      consumableCategories: [...consumableCategories.keys()],
    }),
  );
}

main().finally(() => prisma.$disconnect());
