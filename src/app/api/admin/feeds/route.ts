import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";
import { syncJobFeed, recordFeedSyncResult } from "@/lib/feed-import";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  website: z.string().trim().url().optional().or(z.literal("")),
  feedUrl: z.string().trim().url(),
  feedLabel: z.string().trim().max(120).optional(),
});

/**
 * Admin-only feed directory. Unlike /api/jobs/feeds (scoped to the calling
 * employer's own company), this lists every JobFeed across every company so
 * an admin can see the whole syndication picture — including feeds attached
 * to companies with no real employer behind them — in one place.
 */
export async function GET() {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const feeds = await prisma.jobFeed.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: { select: { id: true, name: true, slug: true, verificationStatus: true } } },
  });
  return NextResponse.json({ feeds });
}

/**
 * Provision a "syndicated" company for a public careers RSS feed we don't
 * otherwise have an employer relationship with, then run its first sync
 * immediately.
 *
 * Every Company row requires a real, unique User owner (schema constraint),
 * so this creates a lightweight placeholder EMPLOYER account nobody signs
 * into — it exists purely so the company can hold jobs, exactly like a real
 * employer's account would. The company is marked VERIFIED and given an
 * internal (non-Stripe) ACTIVE Gold-tier subscription so its feed isn't
 * throttled to the 1-job free-trial allowance; nothing here touches Stripe,
 * so there's no real billing relationship, refund path, or webhook traffic
 * to worry about — the stripeCustomerId/stripeSubscriptionId columns are
 * only NOT NULL + unique, never read by any Stripe call for this company.
 */
export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const d = parsed.data;

  const token = crypto.randomBytes(24).toString("hex");
  const placeholderEmail = `syndicated+${crypto.randomBytes(6).toString("hex")}@fifodido.internal`;
  // Random, never-issued password — this account is never meant to sign in;
  // hashing it (rather than storing a sentinel) keeps passwordHash behaving
  // like every other row if it's ever compared against.
  const passwordHash = await bcrypt.hash(token, 10);

  const { company, feed } = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: placeholderEmail,
        passwordHash,
        role: "EMPLOYER",
        emailVerifiedAt: new Date(),
      },
    });
    const company = await tx.company.create({
      data: {
        ownerId: owner.id,
        name: d.companyName,
        slug: makeSlug(d.companyName),
        website: d.website || null,
        verificationStatus: "VERIFIED",
      },
    });
    await tx.subscription.create({
      data: {
        companyId: company.id,
        tier: "GOLD",
        status: "ACTIVE",
        // Placeholder IDs — this subscription is admin-managed and never
        // touches Stripe, but the columns are required + unique.
        stripeCustomerId: `syndicated_${company.id}`,
        stripeSubscriptionId: `syndicated_${company.id}_sub`,
      },
    });
    const feed = await tx.jobFeed.create({
      data: {
        companyId: company.id,
        url: d.feedUrl,
        label: d.feedLabel || null,
      },
    });
    return { company, feed };
  });

  await logAdminAction(admin.id, "SYNDICATED_COMPANY_CREATED", "COMPANY", company.id, `Feed: ${d.feedUrl}`);

  const result = await syncJobFeed(feed);
  await recordFeedSyncResult(feed.id, result);
  const updatedFeed = await prisma.jobFeed.findUnique({
    where: { id: feed.id },
    include: { company: { select: { id: true, name: true, slug: true, verificationStatus: true } } },
  });

  return NextResponse.json({ feed: updatedFeed, syncResult: result }, { status: 201 });
}
