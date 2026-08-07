-- Canned rejection templates: reusable, company-scoped rejection messages an
-- employer can pick from (or write freeform) when rejecting a candidate.
-- Application.rejectionMessage stores whatever was actually sent, whether
-- from a template or typed fresh -- null means the generic
-- statusNotificationCopy() line was used instead. Run BEFORE deploying the
-- feature code. Apply via Vercel -> Storage -> the Supabase resource ->
-- Query editor. Safe to run more than once.

DO $mig$ BEGIN

CREATE TABLE IF NOT EXISTS "RejectionTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RejectionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RejectionTemplate_companyId_idx" ON "RejectionTemplate"("companyId");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RejectionTemplate_companyId_fkey') THEN
  ALTER TABLE "RejectionTemplate" ADD CONSTRAINT "RejectionTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "rejectionMessage" TEXT;

END $mig$;
