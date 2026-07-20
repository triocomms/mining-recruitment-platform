import { NextRequest, NextResponse } from "next/server";
import { expireJobs, purgeDeletedUsers, dailyRollup, syncJobFeeds } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never execute at build time
export const maxDuration = 60;

/**
 * Single daily cron entrypoint (Vercel Hobby allows daily crons).
 * Runs: job-ad expiry, GDPR hard-purge, analytics rollup.
 * Each sub-job records a CronRun row for the admin status panel.
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

  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
