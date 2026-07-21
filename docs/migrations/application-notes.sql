-- Adds Application.notes — employer-private hiring notes for the applicant
-- tracking pipeline. Never shown to the candidate (only coverNote, the
-- candidate's own note, is candidate-visible). Safe to run more than once.
DO $mig$ BEGIN
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "notes" TEXT;
END $mig$;
