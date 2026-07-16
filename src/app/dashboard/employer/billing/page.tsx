import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { getJobQuota } from "@/lib/quota";
import { CheckoutButton } from "@/components/CheckoutButton";
import type { PlanTier } from "@prisma/client";

export default async function EmployerBillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { ownerId: session.user.id },
    include: { subscription: true },
  });
  if (!company) redirect("/login");

  const quota = await getJobQuota(company.id);
  const activeTier = company.subscription?.status === "ACTIVE" ? company.subscription.tier : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Billing & plans</h1>

      {searchParams.checkout === "success" && (
        <p className="mt-4 rounded-md bg-patina/15 px-4 py-3 text-sm text-patina">
          Payment received — your account updates within a few seconds once Stripe confirms.
        </p>
      )}
      {searchParams.checkout === "cancelled" && (
        <p className="mt-4 rounded-md bg-bone px-4 py-3 text-sm text-ink/60">
          Checkout cancelled. No charge was made.
        </p>
      )}

      <p className="mt-2 text-sm text-ink/60">
        Current plan: <strong>{activeTier ? PLANS[activeTier].label : "Free trial (1 lifetime ad)"}</strong>
        {" · "}{quota.used}/{quota.quota} ads used this period · {quota.overageCredits} overage credit
        {quota.overageCredits === 1 ? "" : "s"}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanTier[]).map((tier) => {
          const p = PLANS[tier];
          const isCurrent = activeTier === tier;
          return (
            <div
              key={tier}
              className={`card flex flex-col ${tier === "GOLD" ? "border-2 border-oregold" : ""}`}
            >
              <p className="font-display text-2xl uppercase tracking-wide">{p.label}</p>
              <p className="mt-1">
                <span className="font-display text-4xl">${p.monthlyUsd}</span>
                <span className="text-sm text-ink/50"> USD / month</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                <li>✓ {p.jobQuota} job ads per month</li>
                <li>✓ Company page & blog</li>
                <li>✓ Candidate messaging ({p.dailyOutreachCap} new outreach/day)</li>
                <li className={p.resumeSearch ? "" : "text-ink/40 line-through"}>
                  Resume database search
                </li>
                <li className={p.priorityPlacement ? "" : "text-ink/40 line-through"}>
                  Priority placement in results
                </li>
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <span className="tag bg-patina/15 text-patina">Current plan</span>
                ) : (
                  <CheckoutButton mode="SUBSCRIPTION" tier={tier} label={activeTier ? "Switch plan" : `Choose ${p.label}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="card mt-8">
        <h2 className="font-display text-xl uppercase tracking-wide">Pay per post</h2>
        <p className="mt-1 text-sm text-ink/60">
          Out of quota but not ready to upgrade? Buy a single job post credit — used automatically the
          next time you publish over your limit.
        </p>
        <div className="mt-3">
          <CheckoutButton mode="OVERAGE" label="Buy 1 post credit ($149–249 by region)" />
        </div>
      </section>

      <p className="mt-6 text-xs text-ink/50">
        Payments are processed by Stripe. Subscriptions renew monthly and can be cancelled any time —
        your quota stays active until the end of the paid period. Prices exclude applicable taxes.
      </p>
    </main>
  );
}
