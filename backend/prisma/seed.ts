import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@mitwpu.edu.in" },
    update: {},
    create: { name: "UMS Admin", email: "admin@mitwpu.edu.in", passwordHash, roles: ["admin", "staff"] },
  });
  const student = await prisma.user.upsert({
    where: { email: "aarav.deshmukh@mitwpu.edu.in" },
    update: {},
    create: { name: "Aarav Deshmukh", email: "aarav.deshmukh@mitwpu.edu.in", passwordHash, roles: ["student"] },
  });
  await prisma.equipment.createMany({
    skipDuplicates: true,
    data: [
      { name: "Creality Ender-5 Plus", description: "Large-format FDM prototyping printer.", category: "3D Printing", status: "available", totalQuantity: 4, availableQuantity: 3, specs: ["350 x 350 x 400 mm", "PLA / PETG / TPU"] },
      { name: "Trotec Speedy 100 Laser", description: "Laser fabrication for acrylic, MDF and ply.", category: "Laser", status: "under_maintenance", totalQuantity: 1, availableQuantity: 0, specs: ["60 W CO2", "610 x 305 mm bed"] },
      { name: "Electronics Bench 02", description: "Soldering and measurement bench.", category: "Electronics", status: "available", totalQuantity: 8, availableQuantity: 6, specs: ["Hakko FX-888D", "100 MHz DSO"] },
    ],
  });
  await prisma.project.create({
    data: { title: "Autonomous Campus Rover", description: "LiDAR-guided campus rover.", creatorId: student.id, status: "verified", tags: ["robotics"] },
  });
  await prisma.event.create({
    data: {
      title: "Laser Safety Orientation",
      description: "Required orientation for laser cutter bookings.",
      organizerId: admin.id,
      location: "Makerspace Lab",
      startTime: new Date("2026-08-17T04:30:00.000Z"),
      endTime: new Date("2026-08-17T05:30:00.000Z"),
      capacity: 30,
    },
  });
}

main().finally(async () => prisma.$disconnect());
