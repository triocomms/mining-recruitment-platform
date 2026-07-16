import Link from "next/link";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@prisma/client";

export const metadata = {
  title: "Pricing for employers — Orebridge",
  description:
    "Simple monthly plans for mining and resources recruiters. Free for candidates, always.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl uppercase tracking-wide">Pricing</h1>
      <p className="mt-2 max-w-2xl text-ink/70">
        Orebridge is <strong>free for candidates, forever</strong> — profiles, applications, and
        messaging cost nothing. Employers pay a flat monthly fee for job ad quota and hiring tools.
        Every new employer account includes <strong>one free job ad</strong> to try the platform.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanTier[]).map((tier) => {
          const p = PLANS[tier];
          return (
            <div key={tier} className={`card flex flex-col ${tier === "GOLD" ? "border-2 border-oregold" : ""}`}>
              {tier === "GOLD" && <p className="label text-oregold">Most complete</p>}
              <p className="font-display text-2xl uppercase tracking-wide">{p.label}</p>
              <p className="mt-1">
                <span className="font-display text-4xl">${p.monthlyUsd}</span>
                <span className="text-sm text-ink/50"> USD / month</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                <li>✓ {p.jobQuota} job ads per month</li>
                <li>✓ Verified company page & blog</li>
                <li>✓ Candidate messaging ({p.dailyOutreachCap} new conversations/day)</li>
                <li>✓ Applicant tracking pipeline</li>
                <li className={p.resumeSearch ? "" : "text-ink/40 line-through"}>Resume database search</li>
                <li className={p.priorityPlacement ? "" : "text-ink/40 line-through"}>Priority placement in search results</li>
              </ul>
              <Link href="/register?role=employer" className="btn-primary mt-4 text-center">
                Start with a free ad
              </Link>
            </div>
          );
        })}
      </div>

      <section className="card mt-8">
        <h2 className="font-display text-xl uppercase tracking-wide">Pay per post</h2>
        <p className="mt-1 text-sm text-ink/70">
          No subscription? Publish individual job ads for <strong>$149–249 USD each</strong>{" "}
          (priced by region), valid for 30 days. Credits never expire.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-2xl uppercase tracking-wide">Common questions</h2>
        <div className="card">
          <p className="font-semibold">Can I cancel any time?</p>
          <p className="mt-1 text-sm text-ink/60">
            Yes. Your quota and features stay active until the end of the paid period; no lock-in contracts.
          </p>
        </div>
        <div className="card">
          <p className="font-semibold">What does verification involve?</p>
          <p className="mt-1 text-sm text-ink/60">
            Upload a business registration document from your dashboard. Our team reviews it within
            1–2 business days. Verification is required for candidate outreach and resume search — it
            keeps the platform safe from fake recruiters.
          </p>
        </div>
        <div className="card">
          <p className="font-semibold">Do unused ads roll over?</p>
          <p className="mt-1 text-sm text-ink/60">
            Monthly quota resets each billing cycle. Pay-per-post credits, however, never expire.
          </p>
        </div>
      </section>
    </main>
  );
}
