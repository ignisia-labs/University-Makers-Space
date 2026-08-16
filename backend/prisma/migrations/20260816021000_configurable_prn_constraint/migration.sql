-- Keep storage normalization invariant without inventing an institution-specific minimum length.
ALTER TABLE "student_profiles" DROP CONSTRAINT IF EXISTS "student_profiles_prn_check";
ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_prn_check"
  CHECK ("prn" = upper("prn") AND "prn" !~ '\\s' AND length("prn") BETWEEN 1 AND 24);
