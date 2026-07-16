import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, priceIdForEnv } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";
import { PlanTier } from "@prisma/client";

const schema = z.object({
  mode: z.enum(["SUBSCRIPTION", "OVERAGE"]),
  tier: z.nativeEnum(PlanTier).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { ownerId: user.id },
    include: { subscription: true },
  });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const customerId = company.subscription?.stripeCustomerId;

  if (d.mode === "SUBSCRIPTION") {
    if (!d.tier) return NextResponse.json({ error: "Choose a plan" }, { status: 400 });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      line_items: [{ price: priceIdForEnv(PLANS[d.tier].stripePriceEnv), quantity: 1 }],
      metadata: { companyId: company.id, tier: d.tier },
      subscription_data: { metadata: { companyId: company.id, tier: d.tier } },
      success_url: `${appUrl}/dashboard/employer/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/employer/billing?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  }

  // Pay-per-post overage: one-time payment for one extra job slot.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(customerId ? { customer: customerId } : { customer_email: user.email }),
    line_items: [{ price: priceIdForEnv("STRIPE_PRICE_OVERAGE"), quantity: 1 }],
    metadata: { companyId: company.id, purpose: "JOB_OVERAGE" },
    success_url: `${appUrl}/dashboard/employer/jobs?overage=success`,
    cancel_url: `${appUrl}/dashboard/employer/jobs?overage=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
