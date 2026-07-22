import { prisma } from "./prisma";
import { rollupDay } from "./analytics";
import { sendEmail } from "./email";
import { shouldCheckSavedSearchToday } from "./saved-search-frequency";

/** Days a soft-deleted account is retained before hard purge. */
export const PURGE_GRACE_DAYS = 30;

async function record<T>(job: string, fn: () => Promise<T>): Promise<{ job: string; ok: boolean; detail: string }> {
  const run = await prisma.cronRun.create({ data: { job } });
  try {
    const result = await fn();
    const detail = typeof result === "string" ? result : JSON.stringify(result);
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, detail },
    });
    return { job, ok: true, detail };
  } catch (err: any) {
    const detail = err?.message ?? "unknown error";
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, detail },
    });
    return { job, ok: false, detail };
  }
}

/** PUBLISHED ads past their expiry become EXPIRED (stops public listing). */
export function expireJobs() {
  return record("expire-jobs", async () => {
    const res = await prisma.job.updateMany({
      where: { status: "PUBLISHED", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    return `${res.count} job(s) expired`;
  });
}

/** Hard-delete soft-deleted users past the legal grace period. */
export function purgeDeletedUsers() {
  return record("purge-deleted", async () => {
    const cutoff = new Date(Date.now() - PURGE_GRACE_DAYS * 24 * 3600 * 1000);
    const victims = await prisma.user.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    // Relations cascade on delete (see schema onDelete: Cascade).
    for (const v of victims) {
      await prisma.user.delete({ where: { id: v.id } });
    }
    return `${victims.length} account(s) purged`;
  });
}

/** Roll up yesterday + today so the analytics dashboard stays current. */
export function dailyRollup() {
  return record("daily-rollup", async () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    await rollupDay(yesterday);
    await rollupDay(today);
    return "rolled up yesterday + today";
  });
}

/** Poll every ACTIVE (or previously-ERRORed, to retry) employer RSS feed. */
export function syncJobFeeds() {
  return record("sync-job-feeds", async () => {
    const { syncAllActiveFeeds } = await import("./feed-import");
    const { feedsProcessed, errors } = await syncAllActiveFeeds();
    return `${feedsProcessed} feed(s) synced, ${errors} error(s)`;
  });
}

/**
 * Job alerts for saved searches: for each SavedSearch, find PUBLISHED jobs
 * matching its filters posted since the last alert (or since it was created,
 * if never alerted), email a digest if there are any, and advance
 * lastNotifiedAt regardless — a saved search with zero new matches this run
 * shouldn't get flooded once a bunch show up later than expected.
 *
 * This cron itself only ever runs once a day, so a WEEKLY-frequency search
 * is skipped on days it isn't due (see shouldCheckSavedSearchToday) — and
 * on a skipped day lastNotifiedAt is deliberately left untouched, so its
 * matches keep accumulating for the next due date instead of being missed.
 */
export function sendSavedSearchAlerts() {
  return record("saved-search-alerts", async () => {
    const searches = await prisma.savedSearch.findMany({
      include: { candidate: { select: { user: { select: { email: true } } } } },
    });

    let alerted = 0;
    let skipped = 0;
    for (const s of searches) {
      if (!shouldCheckSavedSearchToday(s.frequency, s.lastNotifiedAt)) {
        skipped++;
        continue;
      }
      const since = s.lastNotifiedAt ?? s.createdAt;
      const matches = await prisma.job.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { gt: since },
          ...(s.commodity ? { commodity: s.commodity } : {}),
          ...(s.siteType ? { siteType: s.siteType } : {}),
          ...(s.countryCode ? { countryCode: s.countryCode } : {}),
          ...(s.fifoOnly ? { fifo: true } : {}),
          ...(s.minSalary
            ? { OR: [{ salaryMax: { gte: s.minSalary } }, { salaryMax: null, salaryMin: { gte: s.minSalary } }] }
            : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: 15,
        include: { company: { select: { name: true } } },
      });

      if (matches.length > 0) {
        const lines = matches.map((j) => `- ${j.title} — ${j.company.name}`).join("\n");
        await sendEmail({
          to: s.candidate.user.email,
          subject: `${matches.length} new job${matches.length === 1 ? "" : "s"} matching "${s.label || "your saved search"}"`,
          body: `New roles matching your saved search:\n\n${lines}\n\nView them: https://mining-recruitment-platform.vercel.app/jobs`,
          template: "SAVED_SEARCH_ALERT",
        });
        alerted++;
      }
      await prisma.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } });
    }
    return `${searches.length} saved search(es) total, ${searches.length - skipped} checked, ${alerted} alert(s) sent, ${skipped} skipped (not due)`;
  });
}
