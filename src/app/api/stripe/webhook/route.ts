import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PlanTier, SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  if (s === "active" || s === "trialing") return "ACTIVE";
  if (s === "past_due" || s === "unpaid") return "PAST_DUE";
  if (s === "canceled") return "CANCELED";
  return "INCOMPLETE";
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // One-time overage purchase → grant a job slot credit.
      if (session.mode === "payment" && session.metadata?.purpose === "JOB_OVERAGE") {
        await prisma.overagePurchase.upsert({
          where: { stripeSessionId: session.id },
          create: {
            companyId: session.metadata.companyId!,
            stripeSessionId: session.id,
            amountCents: session.amount_total ?? 0,
            currency: session.currency ?? "usd",
          },
          update: {},
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = sub.metadata?.companyId;
      const tier = sub.metadata?.tier as PlanTier | undefined;
      if (!companyId || !tier) break;
      await prisma.subscription.upsert({
        where: { companyId },
        create: {
          companyId,
          tier,
          status: mapStatus(sub.status),
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
        update: {
          tier,
          status: mapStatus(sub.status),
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "CANCELED" },
      });
      break;
    }
    case "invoice.paid": {
      // New billing period → reset the job-ad usage counter.
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason === "subscription_cycle" && invoice.subscription) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription as string },
          data: { jobsUsedThisPeriod: 0, status: "ACTIVE" },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
