import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cse = await prisma.department.upsert({
    where: { code: "CSE" },
    update: { name: "Computer Science & Engineering", isActive: true },
    create: { code: "CSE", name: "Computer Science & Engineering" },
  });
  await prisma.programme.upsert({
    where: { departmentId_code: { departmentId: cse.id, code: "BTECH-CSE" } },
    update: { name: "B.Tech Computer Science & Engineering", isActive: true },
    create: {
      departmentId: cse.id,
      code: "BTECH-CSE",
      name: "B.Tech Computer Science & Engineering",
    },
  });
  for (const value of [1, 2, 3, 4]) {
    await prisma.academicYearOption.upsert({
      where: { value },
      update: { label: `Year ${value}`, isActive: true },
      create: { value, label: `Year ${value}` },
    });
  }

  const lab = await prisma.lab.upsert({
    where: { code: "MAKERSPACE" },
    update: { isActive: true },
    create: {
      code: "MAKERSPACE",
      name: "MIT-WPU MakerSpace",
      description: "University prototyping and fabrication facility.",
      bookingCapacity: 20,
      quickVisitCapacity: 10,
      slotDurationMinutes: 60,
    },
  });
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
    await prisma.labSchedule.upsert({
      where: { labId_dayOfWeek: { labId: lab.id, dayOfWeek } },
      update: { opensAtMinute: 8 * 60 + 30, closesAtMinute: 18 * 60 + 30, isOpen: true },
      create: {
        labId: lab.id,
        dayOfWeek,
        opensAtMinute: 8 * 60 + 30,
        closesAtMinute: 18 * 60 + 30,
      },
    });
  }

  const printing = await prisma.equipmentCategory.upsert({
    where: { labId_name: { labId: lab.id, name: "3D Printing" } },
    update: { isActive: true },
    create: { labId: lab.id, name: "3D Printing" },
  });
  await prisma.equipment.upsert({
    where: { labId_name: { labId: lab.id, name: "Creality Ender-5 Plus" } },
    update: {},
    create: {
      labId: lab.id,
      categoryId: printing.id,
      name: "Creality Ender-5 Plus",
      description: "Large-format FDM prototyping printer.",
      totalQuantity: 4,
      availableQuantity: 4,
      specs: ["350 x 350 x 400 mm", "PLA / PETG / TPU"],
    },
  });

  const materialCategory = await prisma.consumableCategory.upsert({
    where: { labId_name: { labId: lab.id, name: "Prototyping Materials" } },
    update: { isActive: true },
    create: { labId: lab.id, name: "Prototyping Materials" },
  });
  await prisma.consumable.upsert({
    where: { labId_name: { labId: lab.id, name: "PLA Filament" } },
    update: { isActive: true },
    create: {
      labId: lab.id,
      categoryId: materialCategory.id,
      name: "PLA Filament",
      unit: "gram",
      description: "Expected project requirement only; no stock is reserved.",
    },
  });

  const facultyMentorEmail = process.env.SEED_FACULTY_MENTOR_EMAIL?.trim().toLowerCase();
  if (facultyMentorEmail) {
    await prisma.user.upsert({
      where: { email: facultyMentorEmail },
      update: { roles: [UserRole.FACULTY_MENTOR], isActive: true, profileComplete: true },
      create: {
        email: facultyMentorEmail,
        name: process.env.SEED_FACULTY_MENTOR_NAME?.trim() || "Faculty Mentor",
        roles: [UserRole.FACULTY_MENTOR],
        profileComplete: true,
      },
    });
  }

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (superAdminEmail) {
    await prisma.userProvisioning.upsert({
      where: { email: superAdminEmail },
      update: { roles: [UserRole.SUPER_ADMIN], isActive: true },
      create: { email: superAdminEmail, roles: [UserRole.SUPER_ADMIN] },
    });
  }
}

main().finally(async () => prisma.$disconnect());
