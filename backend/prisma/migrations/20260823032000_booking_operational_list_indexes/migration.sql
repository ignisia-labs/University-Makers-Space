-- Operational booking readers can list across all creators/projects/labs. Give
-- those bounded pages global temporal access paths instead of forcing a growing
-- booking table scan and sort.
CREATE INDEX "bookings_slot_starts_at_snapshot_id_idx"
  ON "bookings"("slot_starts_at_snapshot", "id");

CREATE INDEX "bookings_status_slot_starts_at_snapshot_id_idx"
  ON "bookings"("status", "slot_starts_at_snapshot", "id");

CREATE INDEX "bookings_slot_ends_at_snapshot_status_idx"
  ON "bookings"("slot_ends_at_snapshot", "status");
