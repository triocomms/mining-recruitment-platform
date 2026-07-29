import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncJobFeed, recordFeedSyncResult } from "@/lib/feed-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Admin equivalent of /api/jobs/feeds/[feedId]/sync — runs an immediate
 *  sync for any feed, regardless of which company owns it. */
export async function POST(_req: NextRequest, { params }: { params: { feedId: string } }) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const feed = await prisma.jobFeed.findUnique({ where: { id: params.feedId } });
  if (!feed) return NextResponse.json({ error: "Feed not found" }, { status: 404 });

  const result = await syncJobFeed(feed);
  await recordFeedSyncResult(feed.id, result);
  const updated = await prisma.jobFeed.findUnique({
    where: { id: feed.id },
    include: { company: { select: { id: true, name: true, slug: true, verificationStatus: true } } },
  });

  return NextResponse.json({ feed: updated, syncResult: result });
}
