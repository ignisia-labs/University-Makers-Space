-- CreateEnum
CREATE TYPE "VisitSource" AS ENUM ('BOOKING', 'QUICK_VISIT');

-- CreateEnum
CREATE TYPE "VisitCloseReason" AS ENUM ('CHECKED_OUT', 'AUTO_CLOSED_AT_SLOT_END', 'OPERATIONAL_OVERRIDE');

-- AlterTable
ALTER TABLE "lab_date_exceptions" RENAME CONSTRAINT "lab_closures_pkey" TO "lab_date_exceptions_pkey";
ALTER TABLE "lab_date_exceptions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "labs" ADD COLUMN     "late_arrival_grace_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "no_show_release_minutes" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "overstay_grace_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "quick_visits_require_approval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quick_visits" ADD COLUMN     "cancellation_idempotency_key" UUID,
ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancellation_request_fingerprint" CHAR(64),
ADD COLUMN     "cancellation_source" "BookingCancellationSource",
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" UUID,
ADD COLUMN     "creation_request_fingerprint" CHAR(64) NOT NULL,
ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "decided_by_id" UUID,
ADD COLUMN     "decision_reason" TEXT,
ADD COLUMN     "lab_name_snapshot" TEXT NOT NULL,
ADD COLUMN     "slot_ends_at_snapshot" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "slot_starts_at_snapshot" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "time_zone_snapshot" TEXT NOT NULL,
ADD COLUMN     "user_email_snapshot" TEXT NOT NULL,
ADD COLUMN     "user_name_snapshot" TEXT NOT NULL,
ADD COLUMN     "user_prn_snapshot" VARCHAR(24);

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "check_in_idempotency_key" UUID NOT NULL,
ADD COLUMN     "check_in_request_fingerprint" CHAR(64) NOT NULL,
ADD COLUMN     "check_out_idempotency_key" UUID,
ADD COLUMN     "check_out_request_fingerprint" CHAR(64),
ADD COLUMN     "close_reason" "VisitCloseReason",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expected_end_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "expected_start_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "lab_name_snapshot" TEXT NOT NULL,
ADD COLUMN     "late_by_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "overstay_by_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "project_id" UUID,
ADD COLUMN     "project_title_snapshot" TEXT,
ADD COLUMN     "source" "VisitSource" NOT NULL,
ADD COLUMN     "time_zone_snapshot" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_email_snapshot" TEXT NOT NULL,
ADD COLUMN     "user_name_snapshot" TEXT NOT NULL,
ADD COLUMN     "user_prn_snapshot" VARCHAR(24);

-- CreateIndex
CREATE INDEX "quick_visits_lab_id_status_slot_starts_at_snapshot_id_idx" ON "quick_visits"("lab_id", "status", "slot_starts_at_snapshot", "id");

-- CreateIndex
CREATE INDEX "quick_visits_status_slot_starts_at_snapshot_id_idx" ON "quick_visits"("status", "slot_starts_at_snapshot", "id");

-- CreateIndex
CREATE INDEX "quick_visits_slot_ends_at_snapshot_status_idx" ON "quick_visits"("slot_ends_at_snapshot", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quick_visits_cancelled_by_id_cancellation_idempotency_key_key" ON "quick_visits"("cancelled_by_id", "cancellation_idempotency_key");

-- CreateIndex
CREATE INDEX "visits_lab_id_status_expected_end_at_idx" ON "visits"("lab_id", "status", "expected_end_at");

-- CreateIndex
CREATE INDEX "visits_booking_id_status_idx" ON "visits"("booking_id", "status");

-- CreateIndex
CREATE INDEX "visits_project_id_checked_in_at_idx" ON "visits"("project_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "visits_lab_id_checked_in_at_id_idx" ON "visits"("lab_id", "checked_in_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "visits_checked_in_by_id_check_in_idempotency_key_key" ON "visits"("checked_in_by_id", "check_in_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "visits_checked_out_by_id_check_out_idempotency_key_key" ON "visits"("checked_out_by_id", "check_out_idempotency_key");

-- RenameForeignKey
ALTER TABLE "lab_date_exceptions" RENAME CONSTRAINT "lab_closures_lab_id_fkey" TO "lab_date_exceptions_lab_id_fkey";

-- AddForeignKey
ALTER TABLE "quick_visits" ADD CONSTRAINT "quick_visits_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_visits" ADD CONSTRAINT "quick_visits_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 5 invariants that Prisma's schema language cannot express.
-- These are enforced by PostgreSQL so they hold even if application code has a
-- bug, a race, or a future caller that forgets a rule.
-- ─────────────────────────────────────────────────────────────────────────────

-- A person may hold at most ONE live Quick Visit for a given slot. Repeated
-- submissions collapse onto the same row instead of consuming extra capacity.
CREATE UNIQUE INDEX "quick_visits_live_slot_user_uniq"
  ON "quick_visits" ("lab_slot_id", "user_id")
  WHERE "status" IN ('REQUESTED', 'CONFIRMED', 'ACTIVE');

-- A person can be physically inside the MakerSpace only once at a time. This is
-- the invariant that makes live occupancy a trustworthy headcount.
CREATE UNIQUE INDEX "visits_open_per_user_uniq"
  ON "visits" ("user_id")
  WHERE "status" = 'CHECKED_IN';

-- Attendance timestamps must be coherent.
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_checkout_after_checkin_chk"
  CHECK ("checked_out_at" IS NULL OR "checked_out_at" >= "checked_in_at");

-- A closed visit must record who closed it and when; an open visit must not.
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_closed_state_chk"
  CHECK (
    ("status" = 'CHECKED_IN'  AND "checked_out_at" IS NULL AND "close_reason" IS NULL)
    OR
    ("status" = 'CHECKED_OUT' AND "checked_out_at" IS NOT NULL AND "close_reason" IS NOT NULL)
  );

-- The visit source and its parent reference must agree, and exactly one parent
-- may be present. This blocks orphaned or double-parented attendance rows.
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_source_parent_chk"
  CHECK (
    ("source" = 'BOOKING'     AND "booking_id" IS NOT NULL AND "quick_visit_id" IS NULL)
    OR
    ("source" = 'QUICK_VISIT' AND "quick_visit_id" IS NOT NULL AND "booking_id" IS NULL)
  );

ALTER TABLE "visits"
  ADD CONSTRAINT "visits_nonnegative_deltas_chk"
  CHECK ("late_by_minutes" >= 0 AND "overstay_by_minutes" >= 0);

ALTER TABLE "visits"
  ADD CONSTRAINT "visits_expected_window_chk"
  CHECK ("expected_end_at" > "expected_start_at");

ALTER TABLE "quick_visits"
  ADD CONSTRAINT "quick_visits_window_chk"
  CHECK ("slot_ends_at_snapshot" > "slot_starts_at_snapshot");

-- A cancelled Quick Visit must carry its full cancellation record.
ALTER TABLE "quick_visits"
  ADD CONSTRAINT "quick_visits_cancelled_state_chk"
  CHECK (
    "status" <> 'CANCELLED'
    OR ("cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL AND "cancellation_source" IS NOT NULL)
  );

-- Operational grace policy must stay inside sane bounds.
ALTER TABLE "labs"
  ADD CONSTRAINT "labs_attendance_policy_chk"
  CHECK (
    "late_arrival_grace_minutes" BETWEEN 0 AND 240
    AND "overstay_grace_minutes" BETWEEN 0 AND 240
    AND "no_show_release_minutes" BETWEEN 1 AND 480
  );

-- Reconciler hot path: find open visits whose scheduled window has elapsed.
CREATE INDEX "visits_open_expected_end_idx"
  ON "visits" ("expected_end_at")
  WHERE "status" = 'CHECKED_IN';

-- Reconciler hot path: find live Quick Visits whose slot has elapsed.
CREATE INDEX "quick_visits_live_slot_end_idx"
  ON "quick_visits" ("slot_ends_at_snapshot")
  WHERE "status" IN ('REQUESTED', 'CONFIRMED', 'ACTIVE');
