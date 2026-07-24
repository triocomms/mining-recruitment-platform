import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, priceIdForEnv } from "@/lib/stripe";
import { PROMOTION_PRICING } from "@/lib/plans";

const schema = z.object({
  tier: z.enum(["DAYS_30", "DAYS_90"]),
  headline: z.string().trim().min(1).max(100),
  pitch: z.string().trim().min(1).max(500),
});

/**
 * Candidate "Promote Me" boost (P3.9). One-time Stripe payment, same
 * checkout.session.completed pattern as the employer JOB_OVERAGE flow in
 * api/stripe/checkout/route.ts -- this just has its own metadata.purpose so
 * the webhook can tell the two apart.
 *
 * The PromotionListing row is created *before* the Stripe session so the
 * checkout only needs to carry a promotionId in metadata, not the headline
 * and pitch text itself (Stripe metadata values are capped at 500 chars --
 * fine for one field, awkward for several).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // One active (paid, unexpired) promotion at a time -- buying a second
  // one early wouldn't stack usefully and just complicates expiry math.
  const active = await prisma.promotionListing.findFirst({
    where: { candidateId: candidate.id, paidAt: { not: null }, expiresAt: { gt: new Date() } },
  });
  if (active) {
    return NextResponse.json(
      { error: `You already have an active promotion until ${active.expiresAt!.toISOString().slice(0, 10)}` },
      { status: 409 }
    );
  }

  const pricing = PROMOTION_PRICING[d.tier];
  const listing = await prisma.promotionListing.create({
    data: { candidateId: candidate.id, tier: d.tier, headline: d.headline, pitch: d.pitch },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [{ price: priceIdForEnv(pricing.stripePriceEnv), quantity: 1 }],
    metadata: { promotionId: listing.id, purpose: "CANDIDATE_PROMOTION" },
    success_url: `${appUrl}/dashboard/candidate?promotion=success`,
    cancel_url: `${appUrl}/dashboard/candidate?promotion=cancelled`,
  });

  await prisma.promotionListing.update({
    where: { id: listing.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}

/** Candidate's own promotion history, most recent first -- powers the
 * dashboard card's "active until X" / "buy again" state. */
export async function GET() {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ promotions: [] });

  const promotions = await prisma.promotionListing.findMany({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({ promotions });
}
