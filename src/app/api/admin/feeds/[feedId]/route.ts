import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  label: z.string().trim().max(120).optional(),
  url: z.string().trim().url().optional(),
});

/** Admin equivalent of /api/jobs/feeds/[feedId] — no ownership check, since
 *  an admin can manage any feed on any company (including their own
 *  syndicated ones with no real employer behind them). */
export async function PATCH(req: NextRequest, { params }: { params: { feedId: string } }) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const feed = await prisma.jobFeed.findUnique({ where: { id: params.feedId } });
  if (!feed) return NextResponse.json({ error: "Feed not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const updated = await prisma.jobFeed.update({
    where: { id: feed.id },
    data: parsed.data,
    include: { company: { select: { id: true, name: true, slug: true, verificationStatus: true } } },
  });
  return NextResponse.json({ feed: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { feedId: string } }) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const feed = await prisma.jobFeed.findUnique({ where: { id: params.feedId } });
  if (!feed) return NextResponse.json({ error: "Feed not found" }, { status: 404 });

  await prisma.jobFeed.delete({ where: { id: feed.id } });
  return NextResponse.json({ ok: true });
}
