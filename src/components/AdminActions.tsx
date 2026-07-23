"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";

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

export function AdminCredentialActions(props: { kind: "CERTIFICATION" | "EMPLOYMENT_HISTORY"; id: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "VERIFIED" | "REJECTED") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: props.kind, id: props.id, status, notes: notes || undefined }),
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

export function AdminJobReviewActions(props: { jobId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "APPROVE" | "REJECT") {
    if (action === "REJECT" && reason.trim().length < 3) {
      setError("A rejection reason is required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: props.jobId, action, ...(action === "REJECT" ? { reason } : {}) }),
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
        placeholder="Rejection reason (required to reject)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={() => decide("APPROVE")}>
          Approve
        </button>
        <button
          className="btn-ghost flex-1 border-oxide/40 text-oxide"
          disabled={busy}
          onClick={() => decide("REJECT")}
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}

type PendingReviewJob = {
  id: string;
  title: string;
  companyName: string;
  companyVerification: string;
  countryCode: string;
  region: string | null;
  moderationFlags: string[];
  description: string;
  submittedAgo: string;
  /** Country couldn't be confidently detected (RSS/CSV "ZZ" sentinel, or
   *  blank) — server refuses to approve these, so keep them out of bulk
   *  selection and flag them clearly rather than letting an admin discover
   *  the rejection after the fact. */
  unresolvedCountry: boolean;
};

/** Job review queue with multi-select + "Approve N selected", plus the existing
 *  per-row approve/reject for one-at-a-time decisions. */
export function AdminJobReviewQueue(props: { jobs: PendingReviewJob[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ approved: number; blockedUnresolvedCountry: number } | null>(null);

  const { jobs } = props;
  const selectable = jobs.filter((j) => !j.unresolvedCountry);
  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((j) => j.id)));
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    const count = selected.size;
    if (!window.confirm(`Publish ${count} job ad${count === 1 ? "" : "s"}? This can't be undone in bulk.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "BULK_APPROVE", jobIds: Array.from(selected) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setSelected(new Set());
      setResult({ approved: data.approved ?? 0, blockedUnresolvedCountry: data.blockedUnresolvedCountry ?? 0 });
      router.refresh();
    } else {
      setError(data.error ?? "Bulk approve failed");
    }
  }

  if (jobs.length === 0) {
    return <p className="card mt-3 text-sm text-ink/60">Queue is clear.</p>;
  }

  return (
    <div className="mt-3">
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-sand/40">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allSelected} disabled={selectable.length === 0} onChange={toggleAll} />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
        <button className="btn-primary text-sm" disabled={selected.size === 0 || busy} onClick={bulkApprove}>
          {busy ? "Approving…" : selected.size > 0 ? `Approve ${selected.size} selected` : "Approve selected"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
      {result && (
        <p className="mt-1 text-xs text-ink/60">
          {result.approved} approved
          {result.blockedUnresolvedCountry > 0 &&
            ` · ${result.blockedUnresolvedCountry} skipped (unresolved country — reject with a reason instead)`}
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {jobs.map((j) => (
          <li key={j.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={selected.has(j.id)}
                  disabled={j.unresolvedCountry}
                  onChange={() => toggle(j.id)}
                  aria-label={`Select ${j.title}`}
                  title={j.unresolvedCountry ? "Country couldn't be confirmed — can't be bulk approved" : undefined}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{j.title}</p>
                  <p className="text-xs text-ink/60">
                    {j.companyName} · {j.companyVerification.toLowerCase()} ·{" "}
                    {j.unresolvedCountry ? (
                      <span className="text-oxide">location unconfirmed</span>
                    ) : (
                      j.countryCode
                    )}
                    {j.region ? ` · ${j.region}` : ""} · submitted {j.submittedAgo}
                  </p>
                  {j.unresolvedCountry && (
                    <p className="mt-1 text-xs">
                      <span className="tag bg-oxide/15 text-oxide">
                        country not detected — reject with a reason, can&apos;t approve as-is
                      </span>
                    </p>
                  )}
                  {j.moderationFlags.length > 0 && (
                    <p className="mt-1 text-xs">
                      {j.moderationFlags.map((f) => (
                        <span key={f} className="tag mr-1 bg-oxide/15 text-oxide">
                          {f.replaceAll("_", " ").toLowerCase()}
                        </span>
                      ))}
                    </p>
                  )}
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-ink/60">Full description</summary>
                    <div
                      className="mt-1 text-ink/80"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(j.description) }}
                    />
                  </details>
                </div>
              </div>
              <AdminJobReviewActions jobId={j.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminSuspendForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suspend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUSPEND", email, reason }),
    });
    setBusy(false);
    if (res.ok) {
      setEmail("");
      setReason("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
    }
  }

  return (
    <form onSubmit={suspend} className="card space-y-2">
      <input
        className="field text-sm"
        type="email"
        required
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field text-sm"
        required
        minLength={3}
        placeholder="Reason (required, kept on record)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button type="submit" className="btn-dark w-full" disabled={busy}>
        {busy ? "Suspending…" : "Suspend user"}
      </button>
      {error && <p className="text-xs text-oxide">{error}</p>}
    </form>
  );
}

export function AdminUnsuspendButton(props: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unsuspend() {
    setBusy(true);
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UNSUSPEND", userId: props.userId }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button className="btn-ghost text-sm" disabled={busy} onClick={unsuspend}>
      Unsuspend
    </button>
  );
}

export function AdminReportActions(props: { reportId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(status: "RESOLVED" | "DISMISSED") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: props.reportId, status, note: note || undefined }),
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
    <div className="mt-2 w-full max-w-xs">
      <input
        className="field text-sm"
        placeholder="Resolution note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="btn-dark flex-1 text-sm" disabled={busy} onClick={() => close("RESOLVED")}>
          Resolve (upheld)
        </button>
        <button className="btn-ghost flex-1 text-sm" disabled={busy} onClick={() => close("DISMISSED")}>
          Dismiss
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}

export function AdminRefundButton(props: {
  kind: "OVERAGE" | "SUBSCRIPTION";
  targetId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    const reason = window.prompt("Refund reason (kept in the audit log):") ?? undefined;
    if (reason === undefined) return; // cancelled
    setBusy(true);
    setError(null);
    const body =
      props.kind === "OVERAGE"
        ? { kind: "OVERAGE", overagePurchaseId: props.targetId, reason: reason || undefined }
        : { kind: "SUBSCRIPTION", subscriptionId: props.targetId, reason: reason || undefined };
    const res = await fetch("/api/admin/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Refund failed");
    }
  }

  return (
    <div className="text-right">
      <button className="btn-ghost text-sm border-oxide/40 text-oxide" disabled={busy} onClick={refund}>
        {busy ? "Refunding…" : props.label ?? "Refund"}
      </button>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}

export function AdminEmailResendButton(props: { emailLogId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailLogId: props.emailLogId }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Resend failed");
    }
  }

  return (
    <div className="text-right">
      <button className="btn-ghost text-sm" disabled={busy} onClick={resend}>
        {busy ? "Sending…" : "Resend"}
      </button>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}
