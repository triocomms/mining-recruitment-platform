"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MessageComposer(props: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: props.threadId, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      setError(data.error ?? "Could not send");
    }
  }

  return (
    <form onSubmit={send}>
      <div className="flex gap-2">
        <textarea
          className="field min-h-12 flex-1"
          rows={1}
          maxLength={5000}
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
        />
        <button className="btn-primary self-end" disabled={busy || !body.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-oxide" role="alert">{error}</p>}
    </form>
  );
}
