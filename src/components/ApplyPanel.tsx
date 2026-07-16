"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApplyPanel(props: {
  jobId: string;
  applyUrl?: string | null;
  closed: boolean;
  viewerRole: "CANDIDATE" | "EMPLOYER" | "ADMIN" | null;
  applied: boolean;
  bookmarked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [bookmarked, setBookmarked] = useState(props.bookmarked);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(props.applied);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: props.jobId, coverNote: coverNote || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setOpen(false);
    } else if (data.action === "UPLOAD_RESUME") {
      router.push("/dashboard/candidate/profile?need=resume");
    } else {
      setError(data.error ?? "Something went wrong");
    }
  }

  async function toggleBookmark() {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: props.jobId }),
    });
    if (res.ok) setBookmarked((await res.json()).bookmarked);
  }

  if (props.closed) return <div className="card text-sm text-ink/60">Applications for this role have closed.</div>;

  if (!props.viewerRole) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-ink/70">Sign in as a candidate to apply and bookmark roles.</p>
        <a href="/register?role=candidate" className="btn-primary w-full">Create free profile</a>
        <a href="/login" className="btn-ghost w-full">Sign in</a>
      </div>
    );
  }

  if (props.viewerRole !== "CANDIDATE") {
    return <div className="card text-sm text-ink/60">You&apos;re signed in as an employer — applications are for candidate accounts.</div>;
  }

  return (
    <div className="card space-y-3">
      {done ? (
        <p className="rounded-card bg-patina/10 p-3 text-sm font-medium text-patina">
          Application submitted. Track it on your dashboard.
        </p>
      ) : props.applyUrl ? (
        <a href={props.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
          Apply on company site ↗
        </a>
      ) : open ? (
        <>
          <label className="label" htmlFor="coverNote">Message to the employer (optional)</label>
          <textarea
            id="coverNote"
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            rows={5}
            maxLength={3000}
            className="field"
            placeholder="Tickets, availability, roster preferences…"
          />
          <button onClick={apply} disabled={busy} className="btn-primary w-full disabled:opacity-50">
            {busy ? "Submitting…" : "Submit application"}
          </button>
        </>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">Apply now</button>
      )}
      {error && <p className="text-sm text-oxide">{error}</p>}
      <button onClick={toggleBookmark} className="btn-ghost w-full">
        {bookmarked ? "★ Bookmarked" : "☆ Bookmark job"}
      </button>
      <p className="text-xs text-ink/50">Your resume is shared only with this employer when you apply.</p>
    </div>
  );
}
