-- Phase 2 migration — run BEFORE deploying Phase 2 code (single block, safe to paste as one).
DO $mig$ BEGIN
CREATE TABLE IF NOT EXISTS "DailyStat" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "candidateSignups" INTEGER NOT NULL DEFAULT 0,
    "employerSignups" INTEGER NOT NULL DEFAULT 0,
    "jobsPosted" INTEGER NOT NULL DEFAULT 0,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "activeSubs" INTEGER NOT NULL DEFAULT 0,
    "mrrCents" INTEGER NOT NULL DEFAULT 0,
    "mrrCentsBronze" INTEGER NOT NULL DEFAULT 0,
    "mrrCentsSilver" INTEGER NOT NULL DEFAULT 0,
    "mrrCentsGold" INTEGER NOT NULL DEFAULT 0,
    "churnedSubs" INTEGER NOT NULL DEFAULT 0,
    "overageRevenueCents" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyStat_date_key" ON "DailyStat"("date");

CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "broadcastId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_to_idx" ON "EmailLog"("to");

CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CronRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "detail" TEXT,
    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CronRun_job_startedAt_idx" ON "CronRun"("job","startedAt");
END $mig$;
