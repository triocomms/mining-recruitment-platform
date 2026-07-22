"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Lets a candidate flip an existing saved search between daily and weekly
 *  alert emails, matching the DeleteSavedSearchButton pattern next to it. */
export function SavedSearchFrequencyToggle({ id, frequency }: { id: string; frequency: "DAILY" | "WEEKLY" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setFrequency(next: "DAILY" | "WEEKLY") {
    if (next === frequency || busy) return;
    setBusy(true);
    const res = await fetch("/api/saved-searches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, frequency: next }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-1 text-xs text-ink/50">
      <span>Alerts:</span>
      <button
        type="button"
        onClick={() => setFrequency("DAILY")}
        disabled={busy}
        className={frequency === "DAILY" ? "font-semibold text-ink underline" : "underline"}
      >
        Daily
      </button>
      <span>/</span>
      <button
        type="button"
        onClick={() => setFrequency("WEEKLY")}
        disabled={busy}
        className={frequency === "WEEKLY" ? "font-semibold text-ink underline" : "underline"}
      >
        Weekly
      </button>
    </div>
  );
}
