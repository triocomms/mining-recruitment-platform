-- Job alerts / saved searches. Run BEFORE deploying the feature code.
-- Apply via Vercel → Storage → the Supabase resource → Query editor.

DO $mig$ BEGIN

CREATE TABLE IF NOT EXISTS "SavedSearch" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "label" TEXT,
    "commodity" "Commodity",
    "siteType" "SiteExperience",
    "countryCode" TEXT,
    "fifoOnly" BOOLEAN NOT NULL DEFAULT false,
    "minSalary" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),
    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedSearch_candidateId_idx" ON "SavedSearch"("candidateId");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedSearch_candidateId_fkey') THEN
  ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

END $mig$;
