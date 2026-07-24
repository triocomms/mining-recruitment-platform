"use client";

import { useState } from "react";

/**
 * Lets a verified employer open outreach with a candidate directly from
 * their profile page. Reuses the exact /api/messages contract (and daily
 * outreach cap) that CandidateSearch.tsx's inline outreach dialog uses.
 */
export function MessageCandidateButton({ candidateId, name }: { candidateId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, body: message }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setState({ ok: true, text: `Message sent to ${name}` });
      setOpen(false);
      setMessage("");
    } else {
      setState({ ok: false, text: data.error ?? "Could not send" });
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          setOpen(true);
          setState(null);
        }}
      >
        Message {name}
      </button>
      {state && !open && (
        <p className={`mt-2 text-sm ${state.ok ? "text-patina" : "text-oxide"}`} role="status">
          {state.text}
        </p>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <form onSubmit={send} className="card w-full max-w-md bg-white">
            <h3 className="font-display text-xl uppercase tracking-wide">Message {name}</h3>
            <p className="mt-1 text-xs text-ink/50">
              Outreach counts against your plan&rsquo;s daily cap. Keep it relevant -- spam reports affect your
              account.
            </p>
            <textarea
              className="field mt-3 min-h-28"
              required
              maxLength={5000}
              placeholder="Hi -- we're hiring for…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Sending…" : "Send"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
            {state && !state.ok && <p className="mt-2 text-sm text-oxide">{state.text}</p>}
          </form>
        </div>
      )}
    </>
  );
}
