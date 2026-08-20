import { UserRole } from "@prisma/client";

export const permissions = [
  "profile.complete",
  "project.create",
  "project.read.own",
  "project.read.mentored",
  "project.read.any",
  "project.update.own",
  "project.manage.any",
  "project.approve",
  "booking.create",
  "booking.read.own",
  "booking.read.operational",
  "booking.cancel.own",
  "booking.manage",
  "visit.create",
  "visit.check_in",
  "visit.check_out",
  "equipment.read",
  "equipment.manage",
  "equipment.availability.manage",
  "notification.read.own",
  "notification.create",
  "event.read",
  "event.register",
  "event.manage",
  "lab.configure",
  "user.read",
  "user.manage",
  "user.roles.manage",
  "audit.read",
  "upload.create",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  [UserRole.STUDENT]: new Set([
    "profile.complete",
    "project.create",
    "project.read.own",
    "project.update.own",
    "booking.create",
    "booking.read.own",
    "booking.cancel.own",
    "visit.create",
    "equipment.read",
    "notification.read.own",
    "event.read",
    "event.register",
    "upload.create",
  ]),
  [UserRole.FACULTY_MENTOR]: new Set([
    "project.read.mentored",
    "project.approve",
    "booking.read.own",
    "equipment.read",
    "notification.read.own",
    "event.read",
    "event.register",
    "upload.create",
  ]),
  [UserRole.LAB_ASSISTANT]: new Set([
    "project.read.any",
    "booking.read.operational",
    "booking.manage",
    "visit.check_in",
    "visit.check_out",
    "equipment.read",
    "equipment.availability.manage",
    "notification.read.own",
    "event.read",
    "event.manage",
    "upload.create",
  ]),
  [UserRole.ADMIN]: new Set([
    "project.read.any",
    "project.manage.any",
    "booking.read.operational",
    "booking.manage",
    "visit.check_in",
    "visit.check_out",
    "equipment.read",
    "equipment.manage",
    "equipment.availability.manage",
    "notification.read.own",
    "notification.create",
    "event.read",
    "event.manage",
    "lab.configure",
    "user.read",
    "user.manage",
    "upload.create",
  ]),
  [UserRole.SUPER_ADMIN]: new Set(permissions),
};

export function hasPermission(roles: UserRole[], permission: Permission) {
  return roles.some((role) => rolePermissions[role]?.has(permission));
}

export function permissionsFor(roles: UserRole[]) {
  return [...new Set(roles.flatMap((role) => [...(rolePermissions[role] ?? [])]))];
}
