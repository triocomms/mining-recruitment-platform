import type { PlanTier } from "@prisma/client";

export const PLANS: Record<
  PlanTier,
  {
    label: string;
    monthlyUsd: number;
    jobQuota: number;
    resumeSearch: boolean;
    priorityPlacement: boolean;
    /** Max NEW outreach threads an employer may open per day */
    dailyOutreachCap: number;
    stripePriceEnv: string;
  }
> = {
  BRONZE: {
    label: "Bronze",
    monthlyUsd: 299,
    jobQuota: 25,
    resumeSearch: false,
    priorityPlacement: false,
    dailyOutreachCap: 10,
    stripePriceEnv: "STRIPE_PRICE_BRONZE",
  },
  SILVER: {
    label: "Silver",
    monthlyUsd: 599,
    jobQuota: 50,
    resumeSearch: false,
    priorityPlacement: false,
    dailyOutreachCap: 25,
    stripePriceEnv: "STRIPE_PRICE_SILVER",
  },
  GOLD: {
    label: "Gold",
    monthlyUsd: 999,
    jobQuota: 100,
    resumeSearch: true,
    priorityPlacement: true,
    dailyOutreachCap: 60,
    stripePriceEnv: "STRIPE_PRICE_GOLD",
  },
};

/** Employers without an active subscription can post this many free ads (trial). */
export const FREE_JOB_ALLOWANCE = 1;
/** Message caps for accounts without an active paid subscription. */
export const FREE_DAILY_MESSAGE_CAP = 5;
/** Reply cap inside existing threads for everyone (spam brake). */
export const DAILY_MESSAGE_HARD_CAP = 200;

/**
 * Pre-launch early access: the candidate side of the marketplace is still
 * thin (very few registered candidates, no organic applications yet), so a
 * paid employer subscription can't deliver real value today. While this flag
 * is on, every new employer subscription checkout (any tier) is created as a
 * Stripe trial instead of billing immediately -- same plan, same features,
 * $0 due today, and Stripe won't attempt a charge until the trial ends. This
 * is a deliberate single toggle: flip EARLY_ACCESS_MODE to false once there's
 * real candidate traction and the site is ready to charge from day one. No
 * other code needs to change to turn it off.
 */
export const EARLY_ACCESS_MODE = true;
/** Length of the free pre-launch trial applied while EARLY_ACCESS_MODE is on. */
export const EARLY_ACCESS_TRIAL_DAYS = 90;

/** Candidate "Promote Me" boost — one-time payment, surfaces the profile
 * above others in the employer resume database for a fixed window. Prices
 * match the schema comment on PromotionListing/PromotionTier. */
export const PROMOTION_PRICING: Record<
  "DAYS_30" | "DAYS_90",
  { label: string; usd: number; days: number; stripePriceEnv: string }
> = {
  DAYS_30: { label: "30 days", usd: 29, days: 30, stripePriceEnv: "STRIPE_PRICE_PROMOTION_30" },
  DAYS_90: { label: "90 days", usd: 79, days: 90, stripePriceEnv: "STRIPE_PRICE_PROMOTION_90" },
};
