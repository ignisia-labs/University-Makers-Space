-- How many live future bookings one student may hold.
--
-- Defaults to one, matching the slots page, which shows a single upcoming
-- session and asks the student to cancel before taking another. NULL lifts the
-- limit entirely for labs that want to allow several.
ALTER TABLE "labs"
  ADD COLUMN "max_live_bookings_per_student" INTEGER DEFAULT 1;

ALTER TABLE "labs"
  ADD CONSTRAINT "labs_max_live_bookings_per_student_chk"
  CHECK ("max_live_bookings_per_student" IS NULL OR "max_live_bookings_per_student" > 0);
