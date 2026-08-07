-- Site/camp star ratings -- deliberately separate from CompanyRating.
-- Same operator can run a strong site in one country and a rough one in
-- another (roster, climate, camp standard vary by site, not by company), so
-- this table is never joined, averaged, or blended with CompanyRating.
-- Star categories only, same six dimensions as CompanyRating -- no
-- title/body/comment column, by product decision (see
-- src/components/MiningSiteRatingForm.tsx). Run BEFORE deploying the feature
-- code. Apply via Vercel -> Storage -> the Supabase resource -> Query
-- editor. Safe to run more than once.

DO $mig$ BEGIN

CREATE TABLE IF NOT EXISTS "MiningSiteRating" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "rosterRotation" INTEGER NOT NULL,
    "accommodation" INTEGER NOT NULL,
    "food" INTEGER NOT NULL,
    "downtimeFacilities" INTEGER NOT NULL,
    "travelLogistics" INTEGER NOT NULL,
    "safetyCulture" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MiningSiteRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MiningSiteRating_siteId_candidateId_key" ON "MiningSiteRating"("siteId","candidateId");
CREATE INDEX IF NOT EXISTS "MiningSiteRating_siteId_idx" ON "MiningSiteRating"("siteId");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MiningSiteRating_siteId_fkey') THEN
  ALTER TABLE "MiningSiteRating" ADD CONSTRAINT "MiningSiteRating_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "MiningSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MiningSiteRating_candidateId_fkey') THEN
  ALTER TABLE "MiningSiteRating" ADD CONSTRAINT "MiningSiteRating_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

END $mig$;
