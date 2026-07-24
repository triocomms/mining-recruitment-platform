"use client";

import { useState } from "react";

type Tier = "DAYS_30" | "DAYS_90";

const TIERS: { value: Tier; label: string; usd: number }[] = [
  { value: "DAYS_30", label: "30 days", usd: 29 },
  { value: "DAYS_90", label: "90 days", usd: 79 },
];

export type LatestPromotion = {
  tier: Tier;
  headline: string;
  pitch: string;
  paidAt: Date | null;
  expiresAt: Date | null;
} | null;

/**
 * Candidate "Promote Me" boost (P3.9). An active promotion moves the
 * profile to the top of page 1 in the employer resume database search --
 * see api/candidates/search/route.ts -- for a fixed window.
 */
export function PromoteMeCard({ latest }: { latest: LatestPromotion }) {
  const active = latest?.paidAt && latest.expiresAt && new Date(latest.expiresAt) > new Date();

  const [tier, setTier] = useState<Tier>("DAYS_30");
  const [headline, setHeadline] = useState(latest?.headline ?? "");
  const [pitch, setPitch] = useState(latest?.pitch ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, headline, pitch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Could not start checkout");
      return;
    }
    window.location.href = data.url; // off to Stripe Checkout
  }

  if (active) {
    return (
      <div className="card border-ink/10 text-sm">
        <p className="font-semibold">🚀 Profile promoted</p>
        <p className="mt-1 text-ink/60">
          You&rsquo;re featured at the top of employer searches until{" "}
          {new Date(latest!.expiresAt!).toLocaleDateString()}.
        </p>
        <p className="mt-2 text-xs text-ink/50">&ldquo;{latest!.headline}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="card border-ink/10 text-sm">
      <p className="font-semibold">🚀 Promote your profile</p>
      <p className="mt-1 text-ink/60">
        Jump to the top of the employer resume database for a fixed window -- a paid boost, not a
        ranking change against any specific job.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary mt-3 w-full">
          Get promoted from ${TIERS[0].usd}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <div className="flex gap-2">
            {TIERS.map((t) => (
              <label
                key={t.value}
                className={`flex-1 cursor-pointer rounded-card border px-3 py-2 text-center text-xs font-semibold ${
                  tier === t.value ? "border-hivis bg-hivis/5 text-hivis-deep" : "border-ink/15 text-ink/60"
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={t.value}
                  checked={tier === t.value}
                  onChange={() => setTier(t.value)}
                  className="sr-only"
                />
                {t.label} · ${t.usd}
              </label>
            ))}
          </div>
          <input
            className="field text-sm"
            placeholder="Headline (e.g. Ticketed drill & blast supervisor, 8yrs FIFO)"
            maxLength={100}
            required
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <textarea
            className="field min-h-20 text-sm"
            placeholder="Short pitch -- what makes you worth a look?"
            maxLength={500}
            required
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 text-sm" disabled={busy}>
              {busy ? "Redirecting…" : `Pay $${TIERS.find((t) => t.value === tier)!.usd} & promote`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 text-sm">
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-oxide">{error}</p>}
        </form>
      )}
    </div>
  );
}
