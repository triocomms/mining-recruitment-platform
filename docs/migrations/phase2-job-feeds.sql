-- Phase 2 — RSS/XML job feed import. Run BEFORE deploying the feed-import code.
-- Apply via Vercel → Storage → the Supabase resource → Query editor.
-- Run each numbered step in its own query — don't paste the whole file at once.

-- Step 0 (run alone — ALTER TYPE ... ADD VALUE cannot run inside a DO block,
-- and cannot run in the same transaction as anything that uses the new
-- value). 'RSS' has been in schema.prisma since the original scaffold but
-- was never confirmed applied via a tracked migration — this is idempotent
-- either way.
ALTER TYPE "JobSource" ADD VALUE IF NOT EXISTS 'RSS';

-- Step 1 (run alone):
DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobFeedStatus') THEN
    CREATE TYPE "JobFeedStatus" AS ENUM ('ACTIVE','PAUSED','ERROR');
  END IF;
END $t$;

-- Step 2 (single block):
DO $mig$ BEGIN

CREATE TABLE IF NOT EXISTS "JobFeed" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "status" "JobFeedStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobFeed_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobFeed_status_idx" ON "JobFeed"("status");
CREATE INDEX IF NOT EXISTS "JobFeed_companyId_idx" ON "JobFeed"("companyId");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobFeed_companyId_fkey') THEN
  ALTER TABLE "JobFeed" ADD CONSTRAINT "JobFeed_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

-- moderationFlags already exists on Job from phase1; RSS imports reuse it,
-- so no Job-table changes needed here. Job.source already has the RSS value
-- baked into the JobSource enum from the original scaffold.

END $mig$;
