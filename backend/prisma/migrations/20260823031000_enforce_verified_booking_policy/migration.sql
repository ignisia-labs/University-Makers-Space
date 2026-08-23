-- The Version 1 RFP requires a project to be faculty-verified before its
-- Team Leader can reserve attendee capacity. Repair any legacy policy rows and
-- make that invariant impossible to disable through a direct database write.
UPDATE "labs"
SET "project_verification_required" = TRUE
WHERE "project_verification_required" IS NOT TRUE;

ALTER TABLE "labs"
  ADD CONSTRAINT "labs_project_verification_required_v1_check"
  CHECK ("project_verification_required" IS TRUE);
