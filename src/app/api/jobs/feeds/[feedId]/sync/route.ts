import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncJobFeed, recordFeedSyncResult } from "@/lib/feed-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { feedId: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const feed = await prisma.jobFeed.findUnique({ where: { id: params.feedId } });
  if (!feed || feed.companyId !== company.id) {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }

  const result = await syncJobFeed(feed);
  await recordFeedSyncResult(feed.id, result);
  const updated = await prisma.jobFeed.findUnique({ where: { id: feed.id } });

  return NextResponse.json({ feed: updated, syncResult: result });
}
