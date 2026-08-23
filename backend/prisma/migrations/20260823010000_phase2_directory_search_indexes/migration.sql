-- Phase 2 requires indexed, server-side, minimum-length directory search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING GIN (lower("name") gin_trgm_ops)
  WHERE "deleted_at" IS NULL AND "is_active" = true;

CREATE INDEX IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING GIN (lower("email") gin_trgm_ops)
  WHERE "deleted_at" IS NULL AND "is_active" = true;

CREATE INDEX IF NOT EXISTS "student_profiles_prn_trgm_idx"
  ON "student_profiles" USING GIN (lower("prn") gin_trgm_ops);
