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

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
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

/** Ensure the last `days` days exist (idempotent). Today is always refreshed.
 * Used by the nightly cron, which only ever needs a fixed, small window. */
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

/**
 * Range length cap for admin-driven date-range queries (dashboard picker,
 * CSV export). Unlike backfillDays(30) above -- a fixed, trusted internal
 * call -- these ranges come from query params a user can set arbitrarily,
 * so the amount of work per request needs its own bound. 180 days comfortably
 * covers "this year so far" at FiFoDiDo's current age without risking a slow
 * first-load on a serverless function.
 */
export const MAX_RANGE_DAYS = 180;

export type RangePreset = "7d" | "30d" | "90d" | "qtd" | "ytd" | "custom";

/** Resolve a preset (or explicit from/to, for "custom") into a concrete
 * [from, to] day range. Falls back to the last 30 days for anything
 * unrecognised or invalid, so a bad/missing query param never errors --
 * it just shows the same default view as before date ranges existed. */
export function resolveRange(params: { preset?: string; from?: string; to?: string }): {
  from: Date;
  to: Date;
  preset: RangePreset;
} {
  const today = utcDayStart(new Date());
  const daysAgo = (n: number) => new Date(today.getTime() - (n - 1) * 24 * 3600 * 1000);

  if (params.preset === "custom" && params.from && params.to) {
    const from = utcDayStart(new Date(params.from));
    const to = utcDayStart(new Date(params.to));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from.getTime() <= to.getTime()) {
      return { from, to: to.getTime() > today.getTime() ? today : to, preset: "custom" };
    }
  }
  if (params.preset === "7d") return { from: daysAgo(7), to: today, preset: "7d" };
  if (params.preset === "90d") return { from: daysAgo(90), to: today, preset: "90d" };
  if (params.preset === "qtd") {
    const q = Math.floor(today.getUTCMonth() / 3);
    return { from: new Date(Date.UTC(today.getUTCFullYear(), q * 3, 1)), to: today, preset: "qtd" };
  }
  if (params.preset === "ytd") {
    return { from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), to: today, preset: "ytd" };
  }
  return { from: daysAgo(30), to: today, preset: "30d" };
}

/** Ensure DailyStat rows exist for every day in [from, to] (inclusive), then
 * return them ordered ascending. Clamps to MAX_RANGE_DAYS (keeping the most
 * recent days if the requested range is longer) and computes any missing
 * days in small parallel batches rather than one at a time, so a first-ever
 * load of a wide range stays fast instead of running ~180 sequential rollups. */
export async function getStatsRange(from: Date, to: Date) {
  const dayMs = 24 * 3600 * 1000;
  const today = utcDayStart(new Date());
  const start = utcDayStart(from);
  const end = utcDayStart(to).getTime() > today.getTime() ? today : utcDayStart(to);

  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  const days = Math.max(1, Math.min(totalDays, MAX_RANGE_DAYS));
  const clampedStart = new Date(end.getTime() - (days - 1) * dayMs);

  const existing = await prisma.dailyStat.findMany({
    where: { date: { gte: clampedStart, lte: end } },
    select: { date: true },
  });
  const have = new Set(existing.map((e) => e.date.getTime()));

  const toCompute: number[] = [];
  for (let t = clampedStart.getTime(); t <= end.getTime(); t += dayMs) {
    if (t === today.getTime() || !have.has(t)) toCompute.push(t);
  }
  const BATCH = 20;
  for (let i = 0; i < toCompute.length; i += BATCH) {
    await Promise.all(toCompute.slice(i, i + BATCH).map((t) => rollupDay(new Date(t))));
  }

  return prisma.dailyStat.findMany({
    where: { date: { gte: clampedStart, lte: end } },
    orderBy: { date: "asc" },
  });
}

/** Fetch the equal-length period immediately preceding [from, to], for
 * period-over-period comparison deltas on the dashboard. */
export async function getPreviousStatsRange(from: Date, to: Date) {
  const dayMs = 24 * 3600 * 1000;
  const start = utcDayStart(from);
  const end = utcDayStart(to);
  const days = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  const prevEnd = new Date(start.getTime() - dayMs);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * dayMs);
  return getStatsRange(prevStart, prevEnd);
}

type DailyStatRow = Awaited<ReturnType<typeof getStatsRange>>[number];

/** CSV serialisation for the analytics export route -- dollar fields are
 * converted from cents so the file is directly usable in a spreadsheet. */
export function toCsv(stats: DailyStatRow[]): string {
  const headers = [
    "date",
    "candidate_signups",
    "employer_signups",
    "jobs_posted",
    "applications",
    "churned_subs",
    "overage_revenue_usd",
    "active_subs",
    "mrr_bronze_usd",
    "mrr_silver_usd",
    "mrr_gold_usd",
    "mrr_total_usd",
  ];
  const rows = stats.map((s) => [
    isoDate(s.date),
    s.candidateSignups,
    s.employerSignups,
    s.jobsPosted,
    s.applications,
    s.churnedSubs,
    (s.overageRevenueCents / 100).toFixed(2),
    s.activeSubs,
    (s.mrrCentsBronze / 100).toFixed(2),
    (s.mrrCentsSilver / 100).toFixed(2),
    (s.mrrCentsGold / 100).toFixed(2),
    (s.mrrCents / 100).toFixed(2),
  ]);
  return [headers, ...rows].map((r) => r.join(",")).join("\n");
}
