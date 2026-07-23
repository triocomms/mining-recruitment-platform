"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  ["SUBMITTED", "New"],
  ["VIEWED", "Reviewing"],
  ["SHORTLISTED", "Shortlisted"],
  ["INTERVIEW", "Interview"],
  ["OFFER", "Offer"],
  ["REJECTED", "Rejected"],
  ["WITHDRAWN", "Withdrawn"],
] as const;

const STAGE_TONE: Record<string, string> = {
  SUBMITTED: "bg-bone text-ink",
  VIEWED: "bg-bone text-ink",
  SHORTLISTED: "bg-patina/15 text-patina",
  INTERVIEW: "bg-patina/15 text-patina",
  OFFER: "bg-oregold/20 text-ink",
  REJECTED: "bg-oxide/10 text-oxide",
  WITHDRAWN: "bg-bone text-ink/50",
};

type Applicant = {
  id: string;
  status: string;
  notes: string;
  coverNote: string | null;
  resumeKey: string | null;
  resumeName: string | null;
  coverLetterKey: string | null;
  coverLetterName: string | null;
  appliedAgo: string;
  candidate: {
    name: string;
    email: string;
    phone: string | null;
    headline: string | null;
    location: string;
    yearsExperience: number | null;
  };
};

function ApplicantRow({ app }: { app: Applicant }) {
  const router = useRouter();
  const [status, setStatus] = useState(app.status);
  const [notes, setNotes] = useState(app.notes);
  const [savedNotes, setSavedNotes] = useState(app.notes);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyNotes, setBusyNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: app.id, ...body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Update failed");
    }
  }

  async function changeStatus(next: string) {
    const prev = status;
    setStatus(next);
    setBusyStatus(true);
    setError(null);
    try {
      await patch({ status: next });
      router.refresh();
    } catch (e: any) {
      setStatus(prev);
      setError(e.message);
    } finally {
      setBusyStatus(false);
    }
  }

  async function saveNotes() {
    setBusyNotes(true);
    setError(null);
    try {
      await patch({ notes });
      setSavedNotes(notes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyNotes(false);
    }
  }

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{app.candidate.name}</p>
          <p className="text-xs text-ink/60">
            {app.candidate.headline || "No headline"}
            {app.candidate.location && ` · ${app.candidate.location}`}
            {app.candidate.yearsExperience != null && ` · ${app.candidate.yearsExperience} yrs exp`}
            {" · applied "}{app.appliedAgo}
          </p>
          <p className="mt-1 text-xs text-ink/60">
            <a href={`mailto:${app.candidate.email}`} className="underline">{app.candidate.email}</a>
            {app.candidate.phone && <> · {app.candidate.phone}</>}
            {app.resumeKey && (
              <>
                {" · "}
                <a href={`/api/files?key=${encodeURIComponent(app.resumeKey)}`} target="_blank" rel="noreferrer" className="underline">
                  {app.resumeName ?? "Resume"}
                </a>
              </>
            )}
            {app.coverLetterKey && (
              <>
                {" · "}
                <a href={`/api/files?key=${encodeURIComponent(app.coverLetterKey)}`} target="_blank" rel="noreferrer" className="underline">
                  {app.coverLetterName ?? "Cover letter"}
                </a>
              </>
            )}
          </p>
          {app.coverNote && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-ink/60">Cover note</summary>
              <p className="mt-1 whitespace-pre-wrap text-ink/80">{app.coverNote}</p>
            </details>
          )}
        </div>
        <span className={`tag shrink-0 ${STAGE_TONE[status] ?? ""}`}>{STAGES.find(([v]) => v === status)?.[1] ?? status.toLowerCase()}</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
        <select
          className="field text-sm"
          value={status}
          disabled={busyStatus}
          onChange={(e) => changeStatus(e.target.value)}
          aria-label={`Stage for ${app.candidate.name}`}
        >
          {STAGES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="field flex-1 text-sm"
            placeholder="Private hiring notes (only you see these)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busyNotes || notes === savedNotes}
            onClick={saveNotes}
          >
            {busyNotes ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </li>
  );
}

export function ApplicantPipeline({ applications }: { applications: Applicant[] }) {
  if (applications.length === 0) {
    return <p className="card text-sm text-ink/60">No applicants yet.</p>;
  }
  return <ul className="space-y-3">{applications.map((a) => <ApplicantRow key={a.id} app={a} />)}</ul>;
}
