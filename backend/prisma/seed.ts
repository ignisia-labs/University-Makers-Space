import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Baseline seed.
 *
 * Two rules govern what belongs here:
 *
 *  1. **No people.** The only identity this creates is a *provisioning grant*
 *     for the Super Admin — a row that says "if this institutional address ever
 *     signs in, it holds this role". No user account is fabricated, so nobody
 *     exists until they authenticate with Google themselves. That keeps
 *     privileged access deny-by-default and avoids inventing accounts whose
 *     Google identity we cannot know in advance.
 *
 *  2. **No institutional structure.** Departments, programmes and the courses
 *     inside them are the university's own data, and inventing plausible-looking
 *     ones is worse than having none: they read as real, get selected during
 *     onboarding, and quietly attach students to a department that does not
 *     exist. The Super Admin creates these in the administration console.
 *
 * What is seeded is only what the app cannot start without: the lab itself and
 * its opening hours. Equipment and materials are deliberately absent — see the
 * note where they used to be.
 */

const SUPER_ADMIN_EMAIL = "ignisia@mitwpu.edu.in";

async function main() {
  // The one identity in the seed, and it is a grant rather than an account.
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase() || SUPER_ADMIN_EMAIL;
  await prisma.userProvisioning.upsert({
    where: { email: superAdminEmail },
    update: { roles: [UserRole.SUPER_ADMIN], isActive: true },
    create: { email: superAdminEmail, roles: [UserRole.SUPER_ADMIN] },
  });
  // If that address has already signed in, apply the role now rather than
  // waiting for their next sign-in.
  const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (existing && !existing.roles.includes(UserRole.SUPER_ADMIN)) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { roles: [UserRole.SUPER_ADMIN], profileComplete: true },
    });
    await prisma.session.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Academic years are generic scaffolding rather than institutional structure,
  // and onboarding cannot complete without at least one. They remain editable.
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

  // No equipment, no materials, no categories.
  //
  // An earlier version seeded a printer and a spool of filament as plausible
  // examples. They read as real: they were selected on projects and held for
  // bookings before anyone noticed nobody had bought them. The MakerSpace's
  // actual stock is imported from its own inventory sheets
  // (scripts/import-inventory.ts) or entered in the administration console.

  console.log(
    JSON.stringify({
      superAdminProvisioned: superAdminEmail,
      lab: lab.name,
      note: "Departments, programmes, equipment and materials are intentionally not seeded — the Super Admin adds them under Administration, or imports them from the MakerSpace's own inventory sheets.",
    }),
  );
}

main().finally(async () => prisma.$disconnect());
