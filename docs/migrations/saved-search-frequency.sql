-- Saved search alert frequency (P1.5) — daily/weekly choice per saved
-- search. Run BEFORE deploying this feature's code.
-- Apply via Vercel → Storage → the Supabase resource → Query editor.
-- Run each numbered step in its own query — don't paste the whole file at once.

-- Step 1 (run alone — enum type creation cannot run inside a DO block that
-- also uses the new type):
DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertFrequency') THEN
    CREATE TYPE "AlertFrequency" AS ENUM ('DAILY','WEEKLY');
  END IF;
END $t$;

-- Step 2:
DO $mig$ BEGIN

ALTER TABLE "SavedSearch" ADD COLUMN IF NOT EXISTS "frequency" "AlertFrequency" NOT NULL DEFAULT 'DAILY';

END $mig$;
