-- Phase 2 project/team workflow and configurable PRN policy.
ALTER TYPE "ProjectMemberStatus" RENAME VALUE 'INVITED' TO 'PENDING';
ALTER TYPE "ProjectMemberStatus" RENAME VALUE 'REMOVED' TO 'CANCELLED';
ALTER TYPE "ProjectMemberStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "student_profiles" ALTER COLUMN "prn" TYPE VARCHAR(24);
ALTER TABLE "student_profiles" DROP CONSTRAINT IF EXISTS "student_profiles_prn_format";
ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_prn_check"
  CHECK ("prn" = upper("prn") AND "prn" !~ '\\s' AND length("prn") BETWEEN 6 AND 24);

ALTER TABLE "projects"
  ADD COLUMN "idempotency_key" UUID,
  ADD COLUMN "submitted_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "projects_creator_id_idempotency_key_key"
  ON "projects"("creator_id", "idempotency_key");

ALTER TABLE "project_members" ADD COLUMN "responded_at" TIMESTAMP(3);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "users_name_trgm_idx" ON "users" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN (lower("email") gin_trgm_ops);
CREATE INDEX "projects_title_trgm_idx" ON "projects" USING GIN (lower("title") gin_trgm_ops);
