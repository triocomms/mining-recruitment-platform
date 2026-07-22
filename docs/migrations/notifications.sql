-- In-app notifications (P1.4) — backs the header bell + /dashboard/notifications,
-- and is now the single write path for application-status and new-message
-- alerts (P1.2 / P1.3). Run BEFORE deploying this feature's code.
-- Apply via Vercel → Storage → the Supabase resource → Query editor.
-- Run each numbered step in its own query — don't paste the whole file at once.

-- Step 1 (run alone — enum type creation cannot run inside a DO block that
-- also uses the new type):
DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_STATUS','NEW_MESSAGE','SAVED_SEARCH_MATCH');
  END IF;
END $t$;

-- Step 2:
DO $mig$ BEGIN

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

END $mig$;
