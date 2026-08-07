-- Interview scheduling links: an employer offers one or more time slots for
-- an application, and the candidate books one from their own dashboard.
-- Booking sets Application.interviewScheduledAt/interviewLocation (the
-- single source of truth read by both the employer pipeline and the
-- candidate dashboard) and the remaining unbooked InterviewSlot rows for
-- that application are deleted. Run BEFORE deploying the feature code.
-- Apply via Vercel -> Storage -> the Supabase resource -> Query editor.
-- Safe to run more than once.

DO $mig$ BEGIN

CREATE TABLE IF NOT EXISTS "InterviewSlot" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InterviewSlot_applicationId_idx" ON "InterviewSlot"("applicationId");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewSlot_applicationId_fkey') THEN
  ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "interviewScheduledAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "interviewLocation" TEXT;

END $mig$;
