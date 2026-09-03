/**
 * Renders the catalogue artwork, uploads it to Cloudinary, and points the
 * equipment and domains at it.
 *
 * Images are keyed by *category*, not by individual machine: eight temperature
 * sensors do not need eight drawings, and one consistent image per category
 * reads as a catalogue rather than as a set of near-duplicates. Any single item
 * can still be given its own photo later through the admin screens — this only
 * fills what is empty unless --overwrite is passed.
 *
 * Public IDs are stable, so re-running replaces the asset rather than filling
 * the media library with copies.
 *
 *   npx tsx scripts/apply-catalogue-art.ts             # preview
 *   npx tsx scripts/apply-catalogue-art.ts --commit
 *   npx tsx scripts/apply-catalogue-art.ts --commit --overwrite   # replace existing
 */
import "dotenv/config";
import sharp from "sharp";
import { cloudinary } from "../src/config/cloudinary.js";
import { prisma } from "../src/config/db.js";
import { categoryArt, domainTile } from "./lib/equipment-art.js";

const COMMIT = process.argv.includes("--commit");
const OVERWRITE = process.argv.includes("--overwrite");

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function upload(svg: string, publicId: string) {
  const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, resource_type: "image" },
      (error, result) =>
        error || !result ? reject(new Error(JSON.stringify(error))) : resolve(result.secure_url),
    );
    stream.end(png);
  });
}

async function main() {
  const lab = await prisma.lab.findFirstOrThrow({ where: { isActive: true } });

  const categories = await prisma.equipmentCategory.findMany({
    where: { labId: lab.id },
    include: {
      _count: { select: { equipment: true } },
    },
    orderBy: { name: "asc" },
  });
  const domains = await prisma.domain.findMany({
    where: { labId: lab.id },
    orderBy: { sortOrder: "asc" },
  });

  const withArt = categories.filter((category) => categoryArt(category.name));
  const withoutArt = categories.filter((category) => !categoryArt(category.name));

  if (!COMMIT) {
    console.log("Categories that will get artwork:");
    for (const category of withArt) {
      console.log(`  ${category.name} → ${category._count.equipment} machines`);
    }
    if (withoutArt.length) {
      console.log("\nNo artwork defined (machines keep the placeholder):");
      for (const category of withoutArt) console.log(`  ${category.name}`);
    }
    console.log("\nDomain tiles:");
    for (const domain of domains) {
      console.log(`  ${domain.name}${domainTile(domain.name) ? "" : "  (no artwork)"}`);
    }
    console.log("\nPreview only. Re-run with --commit.");
    return;
  }

  let machinesUpdated = 0;
  for (const category of withArt) {
    const url = await upload(categoryArt(category.name)!, `ums/catalogue/category/${slug(category.name)}`);
    const result = await prisma.equipment.updateMany({
      where: {
        categoryId: category.id,
        deletedAt: null,
        ...(OVERWRITE ? {} : { imageUrl: null }),
      },
      data: { imageUrl: url },
    });
    machinesUpdated += result.count;
    console.log(`  ${category.name}: ${result.count} machines`);
  }

  let domainsUpdated = 0;
  for (const domain of domains) {
    const art = domainTile(domain.name);
    if (!art) continue;
    const url = await upload(art, `ums/catalogue/domain/${slug(domain.name)}`);
    if (!OVERWRITE && domain.imageUrl) continue;
    await prisma.domain.update({ where: { id: domain.id }, data: { imageUrl: url } });
    domainsUpdated += 1;
  }

  console.log(
    JSON.stringify({
      machinesUpdated,
      domainsUpdated,
      categoriesWithoutArt: withoutArt.map((category) => category.name),
    }),
  );
}

main().finally(() => prisma.$disconnect());
