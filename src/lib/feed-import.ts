import { prisma } from "./prisma";
import { makeSlug } from "./utils";
import { getJobQuota, consumePublishSlot } from "./quota";
import { companyIsTrusted, detectSpamSignals } from "./moderation";
import { parseAndNormalizeFeed } from "./rss-feed";
import type { JobFeed } from "@prisma/client";

const MAX_ITEMS_PER_SYNC = 300;
const FETCH_TIMEOUT_MS = 15_000;

export type FeedSyncSummary = {
  fetched: number;
  skippedUnparseable: number;
  created: number;
  published: number;
  draftedOverQuota: number;
  pendingReview: number;
  skippedDuplicates: number;
  expiredNoLongerInFeed: number;
};

/**
 * Sync a single JobFeed: fetch the URL, normalize items to the CSV-import
 * row shape, dedupe on externalRef (same key CSV import uses), and create
 * Job rows.
 *
 * Unlike CSV import (a deliberate one-off human upload), RSS runs
 * unattended on a schedule, so it does NOT bypass the moderation queue the
 * way CSV does: rows go PUBLISHED only if quota allows AND the company is
 * trusted AND nothing trips a spam heuristic. Everything else lands in
 * PENDING_REVIEW for an admin (or, if fields are too sparse to review
 * meaningfully, DRAFT for the employer to complete). Jobs previously
 * imported from this feed that have disappeared from the feed are expired,
 * so a de-listed BHP role doesn't linger on Orebridge.
 */
export async function syncJobFeed(feed: JobFeed): Promise<{ summary: FeedSyncSummary; error?: string }> {
  const empty: FeedSyncSummary = {
    fetched: 0,
    skippedUnparseable: 0,
    created: 0,
    published: 0,
    draftedOverQuota: 0,
    pendingReview: 0,
    skippedDuplicates: 0,
    expiredNoLongerInFeed: 0,
  };

  let xml: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "OrebridgeJobFeedBot/1.0 (+https://mining-recruitment-platform.vercel.app)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return { summary: empty, error: `Feed returned HTTP ${res.status}` };
    xml = await res.text();
  } catch (err: any) {
    return { summary: empty, error: err?.name === "AbortError" ? "Feed request timed out" : (err?.message ?? "Fetch failed") };
  }

  let jobs, skipped;
  try {
    ({ jobs, skipped } = parseAndNormalizeFeed(xml));
  } catch (err: any) {
    return { summary: empty, error: err?.message ?? "Could not parse feed" };
  }

  const company = await prisma.company.findUnique({ where: { id: feed.companyId } });
  if (!company) return { summary: empty, error: "Company no longer exists" };

  const trusted = await companyIsTrusted(company.id, company.verificationStatus);
  const items = jobs.slice(0, MAX_ITEMS_PER_SYNC);
  const summary = { ...empty, fetched: items.length, skippedUnparseable: skipped };
  const seenRefs: string[] = [];

  for (const job of items) {
    seenRefs.push(job.externalRef);

    const existing = await prisma.job.findUnique({
      where: { companyId_externalRef: { companyId: company.id, externalRef: job.externalRef } },
    });
    if (existing) {
      summary.skippedDuplicates++;
      continue;
    }

    const spamFlags = await detectSpamSignals(company.id, job.title, job.description);
    // An apply link back to the source ATS is expected for RSS imports —
    // don't flag the one URL we deliberately put in applyUrl territory.
    const flags = spamFlags.filter((f) => f !== "OFF_PLATFORM_CONTACT" || !job.applyUrl);

    let status: "PUBLISHED" | "PENDING_REVIEW" | "DRAFT" = "PENDING_REVIEW";
    let publishedAt: Date | null = null;
    let expiresAt: Date | null = null;

    const cleanEnough = trusted && flags.length === 0 && !job.needsReview;
    if (cleanEnough) {
      const canPublish = await consumePublishSlot(company.id);
      if (canPublish) {
        status = "PUBLISHED";
        publishedAt = new Date();
        expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      } else {
        status = "DRAFT"; // clean, but over quota
      }
    }

    await prisma.job.create({
      data: {
        companyId: company.id,
        title: job.title,
        slug: makeSlug(job.title),
        description: job.description,
        // "ZZ" is not a real ISO 3166-1 code — deliberately unmistakable so a
        // failed-detection row can never be confused with a real country and
        // is always caught by review before publish.
        countryCode: job.countryCode ?? "ZZ",
        region: job.region,
        city: job.city,
        commodity: job.commodity ?? undefined,
        fifo: job.fifo,
        rosterPattern: job.rosterPattern,
        applyUrl: job.applyUrl,
        externalRef: job.externalRef,
        source: "RSS",
        status,
        moderationFlags: [...flags, ...(job.needsReview ? ["RSS_NEEDS_FIELD_REVIEW"] : [])],
        publishedAt,
        expiresAt,
      },
    });

    summary.created++;
    if (status === "PUBLISHED") summary.published++;
    else if (status === "DRAFT") summary.draftedOverQuota++;
    else summary.pendingReview++;
  }

  // Expire previously-imported jobs from this feed that no longer appear in it.
  const expireResult = await prisma.job.updateMany({
    where: {
      companyId: company.id,
      source: "RSS",
      status: "PUBLISHED",
      externalRef: { notIn: seenRefs.length > 0 ? seenRefs : ["__none__"] },
    },
    data: { status: "EXPIRED" },
  });
  summary.expiredNoLongerInFeed = expireResult.count;

  return { summary };
}

export async function recordFeedSyncResult(feedId: string, result: { summary: FeedSyncSummary; error?: string }) {
  await prisma.jobFeed.update({
    where: { id: feedId },
    data: {
      lastFetchedAt: new Date(),
      lastSuccessAt: result.error ? undefined : new Date(),
      lastError: result.error ?? null,
      lastSummary: result.summary as any,
      status: result.error ? "ERROR" : "ACTIVE",
    },
  });
}

export async function syncAllActiveFeeds(): Promise<{ feedsProcessed: number; errors: number }> {
  const feeds = await prisma.jobFeed.findMany({ where: { status: { in: ["ACTIVE", "ERROR"] } } });
  let errors = 0;
  for (const feed of feeds) {
    const result = await syncJobFeed(feed);
    if (result.error) errors++;
    await recordFeedSyncResult(feed.id, result);
  }
  return { feedsProcessed: feeds.length, errors };
}
