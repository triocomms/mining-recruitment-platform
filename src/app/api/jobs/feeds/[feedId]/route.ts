import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  label: z.string().trim().max(120).optional(),
});

async function loadOwnedFeed(feedId: string, userId: string) {
  const company = await prisma.company.findUnique({ where: { ownerId: userId } });
  if (!company) return { error: NextResponse.json({ error: "No company profile" }, { status: 400 }) };
  const feed = await prisma.jobFeed.findUnique({ where: { id: feedId } });
  if (!feed || feed.companyId !== company.id) {
    return { error: NextResponse.json({ error: "Feed not found" }, { status: 404 }) };
  }
  return { feed };
}

export async function PATCH(req: NextRequest, { params }: { params: { feedId: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const { feed, error } = await loadOwnedFeed(params.feedId, user.id);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const updated = await prisma.jobFeed.update({
    where: { id: feed!.id },
    data: parsed.data,
  });
  return NextResponse.json({ feed: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { feedId: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const { feed, error } = await loadOwnedFeed(params.feedId, user.id);
  if (error) return error;

  await prisma.jobFeed.delete({ where: { id: feed!.id } });
  return NextResponse.json({ ok: true });
}
