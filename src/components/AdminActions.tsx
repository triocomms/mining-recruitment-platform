"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminVerifyActions(props: { companyId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "VERIFIED" | "REJECTED") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: props.companyId, status, notes: notes || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
    }
  }

  return (
    <div className="w-full max-w-xs">
      <input
        className="field text-sm"
        placeholder="Reviewer notes (sent on rejection)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={() => decide("VERIFIED")}>
          Approve
        </button>
        <button className="btn-ghost flex-1 border-oxide/40 text-oxide" disabled={busy} onClick={() => decide("REJECTED")}>
          Reject
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}

export function AdminCurateActions(props: { postId: string; curatedRank: number | null; hidden: boolean }) {
  const router = useRouter();
  const [rank, setRank] = useState(props.curatedRank?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  async function apply(payload: { curatedRank: number | null; hide?: boolean }) {
    setBusy(true);
    await fetch("/api/admin/curate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: props.postId, ...payload }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        className="field w-20 text-sm"
        placeholder="rank"
        value={rank}
        onChange={(e) => setRank(e.target.value)}
      />
      <button
        className="btn-dark text-sm"
        disabled={busy}
        onClick={() => apply({ curatedRank: rank === "" ? null : Number(rank) })}
      >
        {rank === "" ? "Unfeature" : "Feature"}
      </button>
      <button
        className="btn-ghost text-sm"
        disabled={busy}
        onClick={() => apply({ curatedRank: null, hide: !props.hidden })}
      >
        {props.hidden ? "Unhide" : "Hide"}
      </button>
    </div>
  );
}
