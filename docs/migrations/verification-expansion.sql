-- Verification expansion (P3.8 follow-through):
--   1. Application.interviewedAt — backs the tightened company-review
--      eligibility bar (must have reached interview stage, not just applied).
--   2. Certification verification fields — admin can approve/reject an
--      uploaded ticket/cert scan, same UNVERIFIED/PENDING/VERIFIED/REJECTED
--      flow as company KYB (that enum already exists, reused here).
--   3. EmploymentHistory table — structured, per-role work history with the
--      same optional-proof-upload + admin verification flow.
-- No new enum types needed — VerificationStatus, SiteExperience, and
-- Commodity all already exist from earlier migrations.
-- Run BEFORE deploying this feature's code.
-- Apply via Vercel → Storage → the Supabase resource → Query editor.
-- Run each numbered step in its own query — don't paste the whole file at once.

-- Step 1:
DO $mig1$ BEGIN

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "interviewedAt" TIMESTAMP(3);

END $mig1$;

-- Step 2:
DO $mig2$ BEGIN

ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT;

CREATE INDEX IF NOT EXISTS "Certification_verificationStatus_idx" ON "Certification"("verificationStatus");

END $mig2$;

-- Step 3:
DO $mig3$ BEGIN

CREATE TABLE IF NOT EXISTS "EmploymentHistory" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "siteType" "SiteExperience",
    "commodity" "Commodity",
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "documentKey" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmploymentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmploymentHistory_candidateId_idx" ON "EmploymentHistory"("candidateId");
CREATE INDEX IF NOT EXISTS "EmploymentHistory_verificationStatus_idx" ON "EmploymentHistory"("verificationStatus");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmploymentHistory_candidateId_fkey') THEN
  ALTER TABLE "EmploymentHistory" ADD CONSTRAINT "EmploymentHistory_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

END $mig3$;
