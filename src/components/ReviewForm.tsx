"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewForm(props: { companyId: string; existing?: { rating: number; title: string | null; body: string } | null }) {
  const router = useRouter();
  const [rating, setRating] = useState(props.existing?.rating ?? 0);
  const [title, setTitle] = useState(props.existing?.title ?? "");
  const [body, setBody] = useState(props.existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: props.companyId, rating, title: title || undefined, body }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save review");
    }
  }

  if (done) return <p className="card text-sm text-patina">✓ Thanks — your review is live.</p>;

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="label">{props.existing ? "Update your review" : "Review this employer"}</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={`text-2xl ${n <= rating ? "text-oregold" : "text-ink/20"}`}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <input
        className="field text-sm"
        placeholder="Headline (optional)"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="field min-h-24 text-sm"
        placeholder="What was it like applying to or working with this company?"
        minLength={20}
        maxLength={2000}
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button type="submit" className="btn-primary w-full" disabled={busy || rating === 0 || body.trim().length < 20}>
        {busy ? "Saving…" : props.existing ? "Update review" : "Post review"}
      </button>
      {error && <p className="text-xs text-oxide">{error}</p>}
    </form>
  );
}
