-- Equipment claimed by a team for one booked slot.
--
-- Holds are derived rather than released: "is this machine busy at 14:00?" is
-- answered by joining to the booking and keeping only live statuses, so a
-- cancellation or completion frees the machine with no second write.
CREATE TABLE "booking_equipment" (
    "booking_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "name_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_equipment_pkey" PRIMARY KEY ("booking_id","equipment_id")
);

CREATE INDEX "booking_equipment_equipment_id_idx" ON "booking_equipment"("equipment_id");

ALTER TABLE "booking_equipment"
  ADD CONSTRAINT "booking_equipment_booking_id_fkey" FOREIGN KEY ("booking_id")
  REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_equipment"
  ADD CONSTRAINT "booking_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id")
  REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A hold is meaningless at zero or negative units.
ALTER TABLE "booking_equipment"
  ADD CONSTRAINT "booking_equipment_quantity_chk" CHECK ("quantity" > 0);
