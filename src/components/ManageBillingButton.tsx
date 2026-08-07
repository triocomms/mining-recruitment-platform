"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "Could not open billing portal");
    setBusy(false);
  }

  return (
    <div>
      <button className="btn-dark" onClick={go} disabled={busy}>
        {busy ? "Redirecting…" : "Manage billing"}
      </button>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}
