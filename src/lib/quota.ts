import { prisma } from "./prisma";
import { PLANS, FREE_JOB_ALLOWANCE } from "./plans";

export type QuotaState = {
  tier: string | null;
  quota: number;
  used: number;
  remaining: number;
  overageCredits: number;
  canPublish: boolean;
  needsOveragePurchase: boolean;
};

export async function getJobQuota(companyId: string): Promise<QuotaState> {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  const overageCredits = await prisma.overagePurchase.count({
    where: { companyId, consumed: false },
  });

  let quota = FREE_JOB_ALLOWANCE;
  let used: number;
  let tier: string | null = null;

  if (sub && sub.status === "ACTIVE") {
    tier = sub.tier;
    quota = PLANS[sub.tier].jobQuota;
    used = sub.jobsUsedThisPeriod;
  } else {
    // Free allowance is lifetime, not monthly.
    used = await prisma.job.count({
      where: { companyId, status: { in: ["PUBLISHED", "EXPIRED"] } },
    });
  }

  const remaining = Math.max(0, quota - used);
  return {
    tier,
    quota,
    used,
    remaining,
    overageCredits,
    canPublish: remaining > 0 || overageCredits > 0,
    needsOveragePurchase: remaining === 0 && overageCredits === 0,
  };
}

/** Atomically consume one publish slot. Returns false if none available. */
export async function consumePublishSlot(companyId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { companyId } });
    if (sub && sub.status === "ACTIVE" && sub.jobsUsedThisPeriod < PLANS[sub.tier].jobQuota) {
      await tx.subscription.update({
        where: { companyId },
        data: { jobsUsedThisPeriod: { increment: 1 } },
      });
      return true;
    }
    // Fall back to an unconsumed overage credit.
    const credit = await tx.overagePurchase.findFirst({
      where: { companyId, consumed: false },
      orderBy: { createdAt: "asc" },
    });
    if (credit) {
      await tx.overagePurchase.update({ where: { id: credit.id }, data: { consumed: true } });
      return true;
    }
    if (!sub || sub.status !== "ACTIVE") {
      const published = await tx.job.count({
        where: { companyId, status: { in: ["PUBLISHED", "EXPIRED"] } },
      });
      return published < FREE_JOB_ALLOWANCE;
    }
    return false;
  });
}
