import { EquipmentStatus } from "@prisma/client";

/**
 * Statuses in which a machine cannot be used, whoever has claimed it.
 *
 * Booking and availability both answer "can this team use this machine?", so
 * the rule lives here rather than being restated in each: a machine that shows
 * as free on the slot picker must be bookable, and a divergence between the two
 * copies would let a student pick a slot the server then rejects.
 */
export const unavailableEquipmentStatuses: ReadonlySet<EquipmentStatus> = new Set([
  EquipmentStatus.UNAVAILABLE,
  EquipmentStatus.UNDER_MAINTENANCE,
  EquipmentStatus.DAMAGED,
  EquipmentStatus.OUT_OF_SERVICE,
]);

/** Is the machine in service at all, ignoring who currently holds it? */
export function isEquipmentInService(equipment: {
  visible: boolean;
  deletedAt: Date | null;
  status: EquipmentStatus;
}) {
  return (
    equipment.visible &&
    equipment.deletedAt === null &&
    !unavailableEquipmentStatuses.has(equipment.status)
  );
}
