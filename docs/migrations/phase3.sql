-- Phase 3 migration — run BEFORE deploying Phase 3 code.
-- Step 1 (run alone):
DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus') THEN
    CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED','HIDDEN');
  END IF;
END $t$;

-- Step 2 (single block):
DO $mig$ BEGIN
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "coverAlt" TEXT;

CREATE TABLE IF NOT EXISTS "BlogPostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BlogPostImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BlogPostImage_postId_order_idx" ON "BlogPostImage"("postId","order");
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlogPostImage_postId_fkey') THEN
  ALTER TABLE "BlogPostImage" ADD CONSTRAINT "BlogPostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;

CREATE TABLE IF NOT EXISTS "CompanyReview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyReview_companyId_candidateId_key" ON "CompanyReview"("companyId","candidateId");
CREATE INDEX IF NOT EXISTS "CompanyReview_companyId_status_idx" ON "CompanyReview"("companyId","status");
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyReview_companyId_fkey') THEN
  ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyReview_candidateId_fkey') THEN
  ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $mig$;
