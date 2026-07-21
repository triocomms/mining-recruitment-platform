-- Employer branding media: photo gallery + optional video link on the
-- public company page. galleryKeys follows the same TEXT[] convention as
-- Job.moderationFlags (see phase1.sql). Safe to run more than once.
DO $mig$ BEGIN
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "galleryKeys" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
END $mig$;
