-- Phase 3: configurable lab policy, date exceptions, and timezone-safe slot materialization.

ALTER TABLE "labs"
  ADD COLUMN "quick_visits_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "max_future_bookings_per_project" INTEGER,
  ADD COLUMN "project_verification_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "configuration_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "labs"
  ADD CONSTRAINT "labs_max_future_bookings_positive"
    CHECK ("max_future_bookings_per_project" IS NULL OR "max_future_bookings_per_project" > 0),
  ADD CONSTRAINT "labs_configuration_version_positive"
    CHECK ("configuration_version" > 0);

DROP INDEX "lab_closures_lab_id_starts_at_ends_at_idx";
ALTER TABLE "lab_closures" DROP CONSTRAINT "lab_closures_valid_range";
ALTER TABLE "lab_closures" RENAME TO "lab_date_exceptions";

ALTER TABLE "lab_date_exceptions"
  ADD COLUMN "local_date" DATE,
  ADD COLUMN "is_closed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "opens_at_minute" INTEGER,
  ADD COLUMN "closes_at_minute" INTEGER,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "lab_date_exceptions" AS exception
SET "local_date" = (
  exception."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(lab."time_zone", 'Asia/Kolkata')
)::date
FROM "labs" AS lab
WHERE lab."id" = exception."lab_id";

ALTER TABLE "lab_date_exceptions"
  ALTER COLUMN "local_date" SET NOT NULL,
  DROP COLUMN "starts_at",
  DROP COLUMN "ends_at";

ALTER TABLE "lab_date_exceptions"
  ADD CONSTRAINT "lab_date_exceptions_hours_valid" CHECK (
    ("is_closed" = true AND "opens_at_minute" IS NULL AND "closes_at_minute" IS NULL)
    OR
    ("is_closed" = false
      AND "opens_at_minute" BETWEEN 0 AND 1439
      AND "closes_at_minute" BETWEEN 1 AND 1440
      AND "opens_at_minute" < "closes_at_minute")
  );

CREATE UNIQUE INDEX "lab_date_exceptions_lab_id_local_date_key"
  ON "lab_date_exceptions"("lab_id", "local_date");
CREATE INDEX "lab_date_exceptions_lab_id_local_date_is_closed_idx"
  ON "lab_date_exceptions"("lab_id", "local_date", "is_closed");

ALTER TABLE "lab_slots"
  ADD COLUMN "local_date" DATE,
  ADD COLUMN "policy_version" INTEGER NOT NULL DEFAULT 1;

UPDATE "lab_slots" AS slot
SET "local_date" = (
  slot."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(lab."time_zone", 'Asia/Kolkata')
)::date
FROM "labs" AS lab
WHERE lab."id" = slot."lab_id";

ALTER TABLE "lab_slots" ALTER COLUMN "local_date" SET NOT NULL;
ALTER TABLE "lab_slots"
  ADD CONSTRAINT "lab_slots_policy_version_positive" CHECK ("policy_version" > 0);
CREATE INDEX "lab_slots_lab_id_local_date_status_idx"
  ON "lab_slots"("lab_id", "local_date", "status");
