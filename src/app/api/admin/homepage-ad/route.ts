import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Fixed id -- HomepageAd is a one-row singleton (see schema.prisma). There is
// exactly one banner placement on the homepage today, so a bookable/multi-row
// model would be premature; upsert on this id keeps that assumption explicit
// rather than silently relying on "whichever row happens to exist".
const SINGLETON_ID = "homepage-ad";

const patchSchema = z.object({
  imageKey: z.string().trim().min(1).nullable().optional(),
  // Empty string clears the link; anything else must be a valid absolute URL
  // since it's rendered as a public homepage <a href>.
  linkUrl: z.union([z.literal(""), z.string().trim().url()]).nullable().optional(),
  enabled: z.boolean().optional(),
});

// Admin-only control for the homepage banner ad (image + click-through URL).
// GET is used by the admin edit page to load current state; the public
// homepage reads the row directly via prisma (see HomepageBannerAd.tsx), not
// through this route, since it's an admin-only endpoint.
export async function GET() {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const ad = await prisma.homepageAd.findUnique({ where: { id: SINGLETON_ID } });
  return NextResponse.json({ ad: ad ?? { id: SINGLETON_ID, imageKey: null, linkUrl: null, enabled: false } });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
  }
  const d = parsed.data;
  const data = {
    ...(d.imageKey !== undefined ? { imageKey: d.imageKey } : {}),
    ...(d.linkUrl !== undefined ? { linkUrl: d.linkUrl || null } : {}),
    ...(d.enabled !== undefined ? { enabled: d.enabled } : {}),
  };

  const ad = await prisma.homepageAd.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });

  await logAdminAction(admin.id, "HOMEPAGE_AD_UPDATED", "HOMEPAGE_AD", ad.id);

  return NextResponse.json({ ad });
}
