import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { logAdminAction } from "@/lib/audit";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("OVERAGE"),
    overagePurchaseId: z.string(),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal("SUBSCRIPTION"),
    subscriptionId: z.string(), // our Subscription.id — refunds the latest paid invoice
    reason: z.string().trim().max(500).optional(),
  }),
]);

/** Admin-issued Stripe refunds for overage purchases and subscription payments. */
export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;

  try {
    if (d.kind === "OVERAGE") {
      const purchase = await prisma.overagePurchase.findUnique({
        where: { id: d.overagePurchaseId },
      });
      if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
      if (purchase.refundedAt) {
        return NextResponse.json({ error: "Already refunded" }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.retrieve(purchase.stripeSessionId);
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      if (!paymentIntent) {
        return NextResponse.json({ error: "No payment found on this purchase" }, { status: 400 });
      }

      const refund = await stripe.refunds.create({ payment_intent: paymentIntent });

      await prisma.$transaction(async (tx) => {
        // If the credit was already spent, give the slot back on the subscription
        // so the refund doesn't leave the company one post short.
        if (purchase.consumed) {
          const sub = await tx.subscription.findUnique({
            where: { companyId: purchase.companyId },
          });
          if (sub && sub.jobsUsedThisPeriod > 0) {
            await tx.subscription.update({
              where: { companyId: purchase.companyId },
              data: { jobsUsedThisPeriod: { decrement: 1 } },
            });
          }
        }
        // Consumed or not, a refunded credit can never be spent (again).
        await tx.overagePurchase.update({
          where: { id: purchase.id },
          data: { consumed: true, refundedAt: new Date() },
        });
      });

      await logAdminAction(
        admin.id,
        "REFUND_OVERAGE",
        "PAYMENT",
        purchase.id,
        `${d.reason ?? ""} (stripe refund ${refund.id})`.trim()
      );
      return NextResponse.json({ ok: true, refundId: refund.id });
    }

    // SUBSCRIPTION: refund the most recent paid invoice.
    const sub = await prisma.subscription.findUnique({ where: { id: d.subscriptionId } });
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId, {
      expand: ["latest_invoice.payment_intent"],
    });
    const invoice = stripeSub.latest_invoice;
    const paymentIntent =
      invoice && typeof invoice !== "string" && invoice.payment_intent
        ? typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : invoice.payment_intent.id
        : null;
    if (!paymentIntent) {
      return NextResponse.json({ error: "No refundable payment on this subscription" }, { status: 400 });
    }

    const refund = await stripe.refunds.create({ payment_intent: paymentIntent });
    await logAdminAction(
      admin.id,
      "REFUND_SUBSCRIPTION",
      "PAYMENT",
      sub.id,
      `${d.reason ?? ""} (stripe refund ${refund.id})`.trim()
    );
    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? "Stripe refund failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
