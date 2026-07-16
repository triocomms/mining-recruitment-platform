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
