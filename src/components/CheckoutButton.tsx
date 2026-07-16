"use client";

import { useState } from "react";

export function CheckoutButton(props: {
  mode: "SUBSCRIPTION" | "OVERAGE";
  tier?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: props.mode, tier: props.tier }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "Could not start checkout");
    setBusy(false);
  }

  return (
    <div>
      <button className={props.mode === "SUBSCRIPTION" ? "btn-primary w-full" : "btn-dark"} onClick={go} disabled={busy}>
        {busy ? "Redirecting…" : props.label}
      </button>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}
