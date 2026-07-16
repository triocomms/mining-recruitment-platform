import { prisma } from "./prisma";
import { PLANS } from "./plans";
import type { PlanTier } from "@prisma/client";

/**
 * Daily metric rollups. One DailyStat row per UTC day. Historical days are
 * computed from createdAt/updatedAt ranges; subscription/MRR numbers are
 * point-in-time (captured when the day is rolled up — accurate when run by
 * the daily cron, approximate when backfilled later).
 */

export function utcDayStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function rollupDay(day: Date) {
  const start = utcDayStart(day);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const range = { gte: start, lt: end };

  const [candidateSignups, employerSignups, jobsPosted, applications, churnedSubs, overage, activeSubsByTier] =
    await Promise.all([
      prisma.user.count({ where: { role: "CANDIDATE", createdAt: range } }),
      prisma.user.count({ where: { role: "EMPLOYER", createdAt: range } }),
      prisma.job.count({ where: { createdAt: range } }),
      prisma.application.count({ where: { createdAt: range } }),
      prisma.subscription.count({ where: { status: "CANCELED", updatedAt: range } }),
      prisma.overagePurchase.aggregate({
        where: { createdAt: range, refundedAt: null },
        _sum: { amountCents: true },
      }),
      prisma.subscription.groupBy({
        by: ["tier"],
        where: { status: "ACTIVE" },
        _count: true,
      }),
    ]);

  const tierCount = (t: PlanTier) =>
    activeSubsByTier.find((r) => r.tier === t)?._count ?? 0;
  const mrr = (t: PlanTier) => tierCount(t) * PLANS[t].monthlyUsd * 100;

  const data = {
    candidateSignups,
    employerSignups,
    jobsPosted,
    applications,
    churnedSubs,
    overageRevenueCents: overage._sum.amountCents ?? 0,
    activeSubs: tierCount("BRONZE") + tierCount("SILVER") + tierCount("GOLD"),
    mrrCentsBronze: mrr("BRONZE"),
    mrrCentsSilver: mrr("SILVER"),
    mrrCentsGold: mrr("GOLD"),
    mrrCents: mrr("BRONZE") + mrr("SILVER") + mrr("GOLD"),
  };

  await prisma.dailyStat.upsert({
    where: { date: start },
    create: { date: start, ...data },
    update: data,
  });
  return data;
}

/** Ensure the last `days` days exist (idempotent). Today is always refreshed. */
export async function backfillDays(days = 30) {
  const today = utcDayStart(new Date());
  const existing = await prisma.dailyStat.findMany({
    where: { date: { gte: new Date(today.getTime() - days * 24 * 3600 * 1000) } },
    select: { date: true },
  });
  const have = new Set(existing.map((e) => e.date.getTime()));
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 24 * 3600 * 1000);
    if (i === 0 || !have.has(day.getTime())) await rollupDay(day);
  }
}
