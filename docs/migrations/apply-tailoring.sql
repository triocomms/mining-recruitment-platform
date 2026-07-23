-- Apply-flow tailoring: candidates can attach a resume and/or cover letter
-- specific to a single application, instead of always silently reusing
-- whatever's on their profile. Also persists original filenames so the UI
-- can show "your_resume.pdf" instead of a generic "file on record".
--
--   1. CandidateProfile.resumeName / coverLetterName — filenames for the
--      profile-level defaults (set alongside resumeKey/coverLetterKey).
--   2. Application.coverLetterKey / resumeName / coverLetterName — the
--      per-application snapshot gains a cover letter slot and both slots
--      gain filenames. (Application.resumeKey already existed.)
-- No new enum types needed.
-- Run BEFORE deploying this feature's code.
-- Apply via Vercel → Storage → the Supabase resource → Query editor.
-- Run each numbered step in its own query — don't paste the whole file at once.

-- Step 1:
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "resumeName" TEXT;

-- Step 2:
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "coverLetterName" TEXT;

-- Step 3:
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "coverLetterKey" TEXT;

-- Step 4:
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "resumeName" TEXT;

-- Step 5:
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "coverLetterName" TEXT;
