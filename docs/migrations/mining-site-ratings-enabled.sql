-- Admin opt-out for site-level star ratings, mirroring Company.ratingsEnabled.
-- Defaults to true so every existing published site keeps ratings on unless
-- an admin explicitly turns them off. Safe to run more than once.

ALTER TABLE "MiningSite" ADD COLUMN IF NOT EXISTS "ratingsEnabled" BOOLEAN NOT NULL DEFAULT true;
