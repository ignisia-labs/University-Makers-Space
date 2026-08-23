-- Phase 4: immutable capacity-booking history and retry-safe command metadata.

CREATE TYPE "BookingCancellationSource" AS ENUM (
  'STUDENT',
  'LAB_ASSISTANT',
  'ADMIN',
  'SUPER_ADMIN'
);

ALTER TABLE "labs"
  ADD COLUMN "team_leader_attendance_required" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "bookings"
  ADD COLUMN "creation_request_fingerprint" CHAR(64),
  ADD COLUMN "cancellation_idempotency_key" UUID,
  ADD COLUMN "cancellation_request_fingerprint" CHAR(64),
  ADD COLUMN "lab_name_snapshot" TEXT,
  ADD COLUMN "project_title_snapshot" TEXT,
  ADD COLUMN "slot_starts_at_snapshot" TIMESTAMP(3),
  ADD COLUMN "slot_ends_at_snapshot" TIMESTAMP(3),
  ADD COLUMN "time_zone_snapshot" TEXT,
  ADD COLUMN "cancellation_window_hours_snapshot" INTEGER,
  ADD COLUMN "cancellation_source" "BookingCancellationSource",
  ADD COLUMN "cancelled_by_name_snapshot" TEXT,
  ADD COLUMN "cancelled_by_role_snapshot" "UserRole";

ALTER TABLE "booking_participants"
  ADD COLUMN "name_snapshot" TEXT,
  ADD COLUMN "email_snapshot" TEXT,
  ADD COLUMN "prn_snapshot" VARCHAR(24),
  ADD COLUMN "project_role_snapshot" "ProjectMemberRole";

CREATE TABLE "booking_status_history" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "from_status" "BookingStatus",
  "to_status" "BookingStatus" NOT NULL,
  "actor_user_id" UUID,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" "UserRole" NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "idempotency_key" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- Backfill immutable booking facts through required foreign keys. The legacy
-- fingerprint is deliberately deterministic but cannot be mistaken for a
-- fingerprint of a new request body.
UPDATE "bookings" AS booking
SET
  "creation_request_fingerprint" =
    md5('phase4-legacy-create:' || booking."id"::text) ||
    md5('phase4-legacy-create-v1:' || booking."id"::text),
  "lab_name_snapshot" = lab."name",
  "project_title_snapshot" = project."title",
  "slot_starts_at_snapshot" = slot."starts_at",
  "slot_ends_at_snapshot" = slot."ends_at",
  "time_zone_snapshot" = lab."time_zone",
  "cancellation_window_hours_snapshot" = lab."cancellation_window_hours"
FROM "labs" AS lab, "projects" AS project, "lab_slots" AS slot
WHERE booking."lab_id" = lab."id"
  AND booking."project_id" = project."id"
  AND booking."lab_slot_id" = slot."id";

UPDATE "booking_participants" AS participant
SET
  "name_snapshot" = app_user."name",
  "email_snapshot" = app_user."email",
  "prn_snapshot" = profile."prn",
  "project_role_snapshot" = COALESCE(
    (
      SELECT member."role"
      FROM "project_members" AS member
      WHERE member."project_id" = booking."project_id"
        AND member."user_id" = participant."user_id"
      LIMIT 1
    ),
    CASE
      WHEN participant."user_id" = booking."created_by_id"
        THEN 'LEADER'::"ProjectMemberRole"
      ELSE 'MEMBER'::"ProjectMemberRole"
    END
  )
FROM "bookings" AS booking, "users" AS app_user
LEFT JOIN "student_profiles" AS profile ON profile."user_id" = app_user."id"
WHERE participant."booking_id" = booking."id"
  AND participant."user_id" = app_user."id";

-- Normalize legacy cancellation data before enforcing the all-or-none
-- cancellation invariant. Physical user deletion can later null the actor FK;
-- the immutable name/role snapshots remain authoritative history.
UPDATE "bookings" AS booking
SET
  "cancelled_at" = GREATEST(
    COALESCE(booking."cancelled_at", booking."updated_at", booking."created_at"),
    booking."created_at"
  ),
  "cancellation_reason" = COALESCE(
    NULLIF(btrim(booking."cancellation_reason"), ''),
    'Legacy cancellation'
  ),
  "cancellation_idempotency_key" = booking."id",
  "cancellation_request_fingerprint" =
    md5('phase4-legacy-cancel:' || booking."id"::text) ||
    md5('phase4-legacy-cancel-v1:' || booking."id"::text),
  "cancellation_source" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "users" AS actor
      WHERE actor."id" = booking."cancelled_by_id"
        AND 'SUPER_ADMIN'::"UserRole" = ANY(actor."roles")
    ) THEN 'SUPER_ADMIN'::"BookingCancellationSource"
    WHEN EXISTS (
      SELECT 1 FROM "users" AS actor
      WHERE actor."id" = booking."cancelled_by_id"
        AND 'ADMIN'::"UserRole" = ANY(actor."roles")
    ) THEN 'ADMIN'::"BookingCancellationSource"
    WHEN EXISTS (
      SELECT 1 FROM "users" AS actor
      WHERE actor."id" = booking."cancelled_by_id"
        AND 'LAB_ASSISTANT'::"UserRole" = ANY(actor."roles")
    ) THEN 'LAB_ASSISTANT'::"BookingCancellationSource"
    ELSE 'STUDENT'::"BookingCancellationSource"
  END,
  "cancelled_by_name_snapshot" = COALESCE(
    (SELECT actor."name" FROM "users" AS actor WHERE actor."id" = booking."cancelled_by_id"),
    'Historical operator'
  ),
  "cancelled_by_role_snapshot" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "users" AS actor
      WHERE actor."id" = booking."cancelled_by_id"
        AND 'SUPER_ADMIN'::"UserRole" = ANY(actor."roles")
    ) THEN 'SUPER_ADMIN'::"UserRole"
    WHEN EXISTS (
      SELECT 1 FROM "users" AS actor
      WHERE actor."id" = booking."cancelled_by_id"
        AND 'ADMIN'::"UserRole" = ANY(actor."roles")
    ) THEN 'ADMIN'::"UserRole"
    WHEN EXISTS (
      SELECT 1 FROM "users" AS actor
      WHERE actor."id" = booking."cancelled_by_id"
        AND 'LAB_ASSISTANT'::"UserRole" = ANY(actor."roles")
    ) THEN 'LAB_ASSISTANT'::"UserRole"
    ELSE 'STUDENT'::"UserRole"
  END
WHERE booking."status" = 'CANCELLED';

UPDATE "bookings"
SET
  "cancelled_by_id" = NULL,
  "cancelled_at" = NULL,
  "cancellation_reason" = NULL,
  "cancellation_idempotency_key" = NULL,
  "cancellation_request_fingerprint" = NULL,
  "cancellation_source" = NULL,
  "cancelled_by_name_snapshot" = NULL,
  "cancelled_by_role_snapshot" = NULL
WHERE "status" <> 'CANCELLED';

ALTER TABLE "bookings"
  ALTER COLUMN "creation_request_fingerprint" SET NOT NULL,
  ALTER COLUMN "lab_name_snapshot" SET NOT NULL,
  ALTER COLUMN "project_title_snapshot" SET NOT NULL,
  ALTER COLUMN "slot_starts_at_snapshot" SET NOT NULL,
  ALTER COLUMN "slot_ends_at_snapshot" SET NOT NULL,
  ALTER COLUMN "time_zone_snapshot" SET NOT NULL,
  ALTER COLUMN "cancellation_window_hours_snapshot" SET NOT NULL;

ALTER TABLE "booking_participants"
  ALTER COLUMN "name_snapshot" SET NOT NULL,
  ALTER COLUMN "email_snapshot" SET NOT NULL,
  ALTER COLUMN "project_role_snapshot" SET NOT NULL;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_snapshot_values_valid" CHECK (
    "slot_ends_at_snapshot" > "slot_starts_at_snapshot"
    AND "cancellation_window_hours_snapshot" >= 0
    AND btrim("lab_name_snapshot") <> ''
    AND btrim("project_title_snapshot") <> ''
    AND btrim("time_zone_snapshot") <> ''
  ),
  ADD CONSTRAINT "bookings_creation_fingerprint_valid" CHECK (
    "creation_request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "bookings_cancellation_metadata_consistent" CHECK (
    (
      "status" = 'CANCELLED'
      AND "cancelled_at" IS NOT NULL
      AND "cancelled_at" >= "created_at"
      AND "cancellation_reason" IS NOT NULL
      AND btrim("cancellation_reason") <> ''
      AND "cancellation_idempotency_key" IS NOT NULL
      AND "cancellation_request_fingerprint" ~ '^[0-9a-f]{64}$'
      AND "cancellation_source" IS NOT NULL
      AND "cancelled_by_name_snapshot" IS NOT NULL
      AND btrim("cancelled_by_name_snapshot") <> ''
      AND "cancelled_by_role_snapshot" IS NOT NULL
      AND (
        ("cancellation_source" = 'STUDENT' AND "cancelled_by_role_snapshot" = 'STUDENT')
        OR ("cancellation_source" = 'LAB_ASSISTANT' AND "cancelled_by_role_snapshot" = 'LAB_ASSISTANT')
        OR ("cancellation_source" = 'ADMIN' AND "cancelled_by_role_snapshot" = 'ADMIN')
        OR ("cancellation_source" = 'SUPER_ADMIN' AND "cancelled_by_role_snapshot" = 'SUPER_ADMIN')
      )
    )
    OR
    (
      "status" <> 'CANCELLED'
      AND "cancelled_by_id" IS NULL
      AND "cancelled_at" IS NULL
      AND "cancellation_reason" IS NULL
      AND "cancellation_idempotency_key" IS NULL
      AND "cancellation_request_fingerprint" IS NULL
      AND "cancellation_source" IS NULL
      AND "cancelled_by_name_snapshot" IS NULL
      AND "cancelled_by_role_snapshot" IS NULL
    )
  );

ALTER TABLE "booking_participants"
  ADD CONSTRAINT "booking_participants_snapshots_valid" CHECK (
    btrim("name_snapshot") <> '' AND btrim("email_snapshot") <> ''
  );

ALTER TABLE "booking_status_history"
  ADD CONSTRAINT "booking_status_history_transition_valid" CHECK (
    "from_status" IS NULL OR "from_status" <> "to_status"
  ),
  ADD CONSTRAINT "booking_status_history_actor_snapshot_valid" CHECK (
    btrim("actor_name_snapshot") <> ''
  );

-- Every legacy booking receives one explicit baseline state. Exact pre-migration
-- intermediate transitions cannot be reconstructed, so the note says so.
INSERT INTO "booking_status_history" (
  "id",
  "booking_id",
  "from_status",
  "to_status",
  "actor_user_id",
  "actor_name_snapshot",
  "actor_role_snapshot",
  "reason",
  "notes",
  "idempotency_key",
  "created_at"
)
SELECT
  booking."id",
  booking."id",
  NULL,
  booking."status",
  CASE
    WHEN booking."status" = 'CANCELLED' THEN booking."cancelled_by_id"
    ELSE booking."created_by_id"
  END,
  CASE
    WHEN booking."status" = 'CANCELLED' THEN booking."cancelled_by_name_snapshot"
    ELSE creator."name"
  END,
  CASE
    WHEN booking."status" = 'CANCELLED' THEN booking."cancelled_by_role_snapshot"
    WHEN 'STUDENT'::"UserRole" = ANY(creator."roles") THEN 'STUDENT'::"UserRole"
    ELSE creator."roles"[1]
  END,
  CASE WHEN booking."status" = 'CANCELLED' THEN booking."cancellation_reason" ELSE NULL END,
  'Legacy booking state backfilled during the Phase 4 migration.',
  CASE
    WHEN booking."status" = 'CANCELLED' THEN booking."cancellation_idempotency_key"
    WHEN booking."status" = 'CONFIRMED' THEN booking."idempotency_key"
    ELSE NULL
  END,
  CASE
    WHEN booking."status" = 'CANCELLED' THEN booking."cancelled_at"
    WHEN booking."status" = 'CONFIRMED' THEN booking."created_at"
    ELSE booking."updated_at"
  END
FROM "bookings" AS booking
JOIN "users" AS creator ON creator."id" = booking."created_by_id";

-- Fail rather than silently choose a winner if legacy data already violates the
-- new single-live-booking rule.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "bookings"
    WHERE "status" IN ('CONFIRMED', 'ACTIVE')
    GROUP BY "project_id", "lab_slot_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot add active project-slot uniqueness: duplicate live bookings exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "bookings_one_live_project_slot_key"
  ON "bookings"("project_id", "lab_slot_id")
  WHERE "status" IN ('CONFIRMED', 'ACTIVE');

CREATE UNIQUE INDEX "bookings_cancelled_by_id_cancellation_idempotency_key_key"
  ON "bookings"("cancelled_by_id", "cancellation_idempotency_key");
CREATE INDEX "bookings_created_by_id_status_slot_starts_at_snapshot_id_idx"
  ON "bookings"("created_by_id", "status", "slot_starts_at_snapshot", "id");
CREATE INDEX "bookings_project_id_status_slot_starts_at_snapshot_id_idx"
  ON "bookings"("project_id", "status", "slot_starts_at_snapshot", "id");
CREATE INDEX "bookings_lab_id_status_slot_starts_at_snapshot_id_idx"
  ON "bookings"("lab_id", "status", "slot_starts_at_snapshot", "id");
CREATE INDEX "booking_participants_user_id_booking_id_idx"
  ON "booking_participants"("user_id", "booking_id");
CREATE UNIQUE INDEX "booking_status_history_booking_id_idempotency_key_key"
  ON "booking_status_history"("booking_id", "idempotency_key");
CREATE INDEX "booking_status_history_booking_id_created_at_id_idx"
  ON "booking_status_history"("booking_id", "created_at", "id");
CREATE INDEX "booking_status_history_actor_user_id_created_at_idx"
  ON "booking_status_history"("actor_user_id", "created_at");

ALTER TABLE "booking_status_history"
  ADD CONSTRAINT "booking_status_history_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "booking_status_history_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_participants"
  DROP CONSTRAINT "booking_participants_booking_id_fkey",
  ADD CONSTRAINT "booking_participants_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The RFP treats equipment and consumables as project-level advisory
-- requirements. Abort if an unknown environment contains legacy allocations so
-- that no operational data is discarded silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "booking_equipment" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "booking_consumables" LIMIT 1) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Legacy booking resource allocations must be reviewed before Phase 4 migration';
  END IF;
END $$;

DROP TABLE "booking_equipment";
DROP TABLE "booking_consumables";

ALTER TABLE "bookings"
  DROP COLUMN "qr_token_hash",
  DROP COLUMN "qr_expires_at";

ALTER TABLE "quick_visits"
  DROP COLUMN "qr_token_hash",
  DROP COLUMN "qr_expires_at";
