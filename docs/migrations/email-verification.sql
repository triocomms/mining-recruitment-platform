-- Email verification migration (applied 2026-07-17)
DO $mig$ BEGIN
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_verifyTokenHash_key" ON "User"("verifyTokenHash");
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;
END $mig$;
