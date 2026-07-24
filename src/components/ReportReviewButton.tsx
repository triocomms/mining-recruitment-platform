"use client";

import { useState } from "react";

const REASONS = [
  ["FAKE_NOT_A_CANDIDATE", "Doesn't look like a genuine candidate review"],
  ["DEFAMATORY_ABUSIVE", "Defamatory, abusive, or personal attack"],
  ["DISCRIMINATORY", "Discriminatory content"],
  ["CONFIDENTIAL_INFO", "Reveals confidential or identifying information"],
  ["OTHER", "Other"],
] as const;

export function ReportReviewButton({ reviewId, signedIn }: { reviewId: string; signedIn: boolean }) {
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
      body: JSON.stringify({ targetType: "REVIEW", targetId: reviewId, reason, comment: comment || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setResult({ ok: true, text: "Reported -- an admin will review it." });
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
        <a href="/login" className="underline">Sign in</a> to report this review.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink/40 underline hover:text-oxide"
      >
        Report
      </button>
    );
  }

  return (
    <div className="card space-y-2 text-sm">
      <p className="font-semibold">Report this review</p>
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
