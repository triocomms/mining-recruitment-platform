"use client";

import { useState } from "react";

type Filters = { commodity?: string; site?: string; country?: string; fifo?: string; minSalary?: string };

export function SaveSearchButton({ signedIn, filters }: { signedIn: boolean; filters: Filters }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const hasAnyFilter = Boolean(filters.commodity || filters.site || filters.country || filters.fifo === "1" || filters.minSalary);
  if (!hasAnyFilter) return null; // nothing meaningful to alert on yet

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label || undefined,
        commodity: filters.commodity || undefined,
        siteType: filters.site || undefined,
        countryCode: filters.country || undefined,
        fifoOnly: filters.fifo === "1",
        minSalary: filters.minSalary ? Number(filters.minSalary) : undefined,
        frequency,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({
        ok: true,
        text: `Saved — we'll email you ${frequency === "WEEKLY" ? "weekly" : "daily"} when new matching jobs go live.`,
      });
      setOpen(false);
    } else {
      setMsg({ ok: false, text: data.error ?? "Could not save search" });
    }
  }

  if (msg?.ok) return <p className="mt-2 text-xs text-patina">{msg.text}</p>;

  if (!signedIn) {
    return (
      <p className="mt-2 text-xs text-ink/50">
        <a href="/register?role=candidate" className="underline">Create a free profile</a> to save this search and get
        alerts when new jobs match.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs underline">
        Save this search &amp; get email alerts
      </button>
    );
  }

  return (
    <div className="card mt-2 flex flex-wrap items-center gap-2 text-sm">
      <input
        className="field flex-1 text-sm"
        placeholder="Name this search (optional)"
        value={label}
        maxLength={80}
        onChange={(e) => setLabel(e.target.value)}
      />
      <select
        className="field text-sm"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value as "DAILY" | "WEEKLY")}
        aria-label="Alert frequency"
      >
        <option value="DAILY">Daily alerts</option>
        <option value="WEEKLY">Weekly alerts</option>
      </select>
      <button type="button" onClick={save} disabled={busy} className="btn-dark text-sm">
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">
        Cancel
      </button>
      {msg && !msg.ok && <p className="w-full text-xs text-oxide">{msg.text}</p>}
    </div>
  );
}
