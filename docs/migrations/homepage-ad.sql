-- Homepage banner ad, admin-managed (see src/app/dashboard/admin/homepage-ad
-- and src/components/HomepageBannerAd.tsx). One-row singleton table -- the
-- app always upserts/reads the row with id 'homepage-ad'. Run BEFORE
-- deploying the feature code. Safe to run more than once.

CREATE TABLE IF NOT EXISTS "HomepageAd" (
    "id" TEXT NOT NULL,
    "imageKey" TEXT,
    "linkUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomepageAd_pkey" PRIMARY KEY ("id")
);
