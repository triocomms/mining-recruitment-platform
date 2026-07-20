import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncJobFeed, recordFeedSyncResult } from "@/lib/feed-import";

export const dynamic = "force-dynamic";

const createFeedSchema = z.object({
  url: z.string().trim().url(),
  label: z.string().trim().max(120).optional(),
});

export async function GET() {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const feeds = await prisma.jobFeed.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ feeds });
}

/**
 * Register a new feed and run an immediate first sync so the employer gets
 * feedback right away instead of waiting for the next cron pass.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createFeedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid feed URL" }, { status: 400 });
  }

  const feedCount = await prisma.jobFeed.count({ where: { companyId: company.id } });
  if (feedCount >= 10) {
    return NextResponse.json({ error: "Maximum 10 feeds per company" }, { status: 400 });
  }

  const feed = await prisma.jobFeed.create({
    data: { companyId: company.id, url: parsed.data.url, label: parsed.data.label || null },
  });

  const result = await syncJobFeed(feed);
  await recordFeedSyncResult(feed.id, result);
  const updated = await prisma.jobFeed.findUnique({ where: { id: feed.id } });

  return NextResponse.json({ feed: updated, syncResult: result }, { status: 201 });
}
