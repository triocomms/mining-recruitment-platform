import { NextRequest, NextResponse } from "next/server";
import { expireJobs, purgeDeletedUsers, dailyRollup, syncJobFeeds, sendSavedSearchAlerts } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never execute at build time
export const maxDuration = 60;

/**
 * Single daily cron entrypoint (Vercel Hobby allows daily crons).
 * Runs: job-ad expiry, GDPR hard-purge, analytics rollup, RSS feed sync,
 * saved-search job alerts. Each sub-job records a CronRun row for the admin
 * status panel.
 *
 * NB: syncJobFeeds was already defined in src/lib/cron.ts and imported here,
 * but was never actually invoked below — RSS feeds were only ever syncing
 * via the manual "Sync now" button, never automatically. Fixed as part of
 * wiring in sendSavedSearchAlerts, since both belong in this same list.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = [];
  results.push(await expireJobs());
  results.push(await purgeDeletedUsers());
  results.push(await dailyRollup());
  results.push(await syncJobFeeds());
  results.push(await sendSavedSearchAlerts());

  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
