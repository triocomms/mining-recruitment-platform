-- Phase 1 migration — run BEFORE deploying Phase 1 code to production.
-- Step 1: run this line on its own first (enum values can't be added inside the DO block):
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'PUBLISHED';

-- Step 2: then run the rest (single statement, safe to paste as one block):
DO $mig$ BEGIN
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "moderationFlags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "OveragePurchase" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType","targetId");
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminAuditLog_adminId_fkey') THEN
  ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $mig$;
