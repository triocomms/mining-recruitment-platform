import { prisma } from "./prisma";
import { rollupDay } from "./analytics";

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
