import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { ownerId: user.id },
    include: { subscription: true },
  });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const customerId = company.subscription?.stripeCustomerId;
  if (!customerId) {
    // No Stripe Customer exists until a company has completed checkout at
    // least once (see the Subscription webhook handler) -- nothing for the
    // Billing Portal to manage yet.
    return NextResponse.json(
      { error: "Choose a plan first -- there's no billing account to manage yet." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/employer/billing`,
  });

  return NextResponse.json({ url: session.url });
}
