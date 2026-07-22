"use client";

import { useState } from "react";

const REASONS = [
  ["SPAM_SCAM", "Spam or scam (e.g. asks for payment, fake recruiter)"],
  ["MISLEADING", "Misleading — doesn't match the actual role"],
  ["DISCRIMINATORY", "Discriminatory content"],
  ["EXPIRED", "Role already filled or expired"],
  ["OTHER", "Other"],
] as const;

export function ReportJobButton({ jobId, signedIn }: { jobId: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0][0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "JOB", targetId: jobId, reason, comment: comment || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setResult({ ok: true, text: "Reported — an admin will review it." });
      setOpen(false);
    } else {
      setResult({ ok: false, text: data.error ?? "Could not submit report" });
    }
  }

  if (result?.ok) {
    return <p className="text-xs text-patina">{result.text}</p>;
  }

  if (!signedIn) {
    return (
      <p className="text-xs text-ink/40">
        <a href="/login" className="underline">Sign in</a> to report this ad.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full border border-oxide/30 bg-oxide/5 px-3 py-1.5 text-xs font-medium text-oxide transition-colors hover:border-oxide/50 hover:bg-oxide/10"
      >
        Report this ad
      </button>
    );
  }

  return (
    <div className="card space-y-2 text-sm">
      <p className="font-semibold">Report this ad</p>
      <select className="field text-sm" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
        {REASONS.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <textarea
        className="field text-sm"
        rows={3}
        maxLength={1000}
        placeholder="Optional details"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="btn-dark flex-1 text-sm">
          {busy ? "Submitting…" : "Submit report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 text-sm">
          Cancel
        </button>
      </div>
      {result && !result.ok && <p className="text-xs text-oxide">{result.text}</p>}
    </div>
  );
}
