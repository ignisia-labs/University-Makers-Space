ALTER TABLE "project_members"
  ADD COLUMN "invitation_email_status" "DeliveryStatus",
  ADD COLUMN "invitation_email_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "invitation_email_sent_at" TIMESTAMP(3);

UPDATE "project_members"
SET "invitation_email_status" = 'PENDING'
WHERE "role" = 'MEMBER'
  AND "status" = 'PENDING';

CREATE INDEX "project_members_invitation_email_status_created_at_idx"
ON "project_members"("invitation_email_status", "created_at");
