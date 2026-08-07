"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

type RejectionTemplate = { id: string; name: string; body: string };

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
    id: string;
    name: string;
    email: string;
    phone: string | null;
    headline: string | null;
    location: string;
    yearsExperience: number | null;
  };
};

function ApplicantRow({ app, templates }: { app: Applicant; templates: RejectionTemplate[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(app.status);
  const [notes, setNotes] = useState(app.notes);
  const [savedNotes, setSavedNotes] = useState(app.notes);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyNotes, setBusyNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [rejectionMessage, setRejectionMessage] = useState("");

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
    if (next === "REJECTED") {
      // Don't fire immediately -- open the picker so the employer can choose
      // (or write) the message the candidate will actually see.
      setSelectedTemplateId("");
      setRejectionMessage("");
      setRejecting(true);
      return;
    }
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

  function pickTemplate(id: string) {
    setSelectedTemplateId(id);
    const t = templates.find((t) => t.id === id);
    setRejectionMessage(t ? t.body : "");
  }

  async function sendRejection() {
    setBusyStatus(true);
    setError(null);
    try {
      await patch({ status: "REJECTED", rejectionMessage });
      setStatus("REJECTED");
      setRejecting(false);
      router.refresh();
    } catch (e: any) {
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
          <p className="font-semibold">
            <Link href={`/dashboard/employer/candidates/${app.candidate.id}`} className="hover:underline">
              {app.candidate.name}
            </Link>
          </p>
          <p className="text-xs text-ink/60">
            {app.candidate.headline || "No headline"}
            {app.candidate.location && ` Â· ${app.candidate.location}`}
            {app.candidate.yearsExperience != null && ` Â· ${app.candidate.yearsExperience} yrs exp`}
            {" Â· applied "}{app.appliedAgo}
          </p>
          <p className="mt-1 text-xs text-ink/60">
            <a href={`mailto:${app.candidate.email}`} className="underline">{app.candidate.email}</a>
            {app.candidate.phone && <> Â· {app.candidate.phone}</>}
            {app.resumeKey && (
              <>
                {" Â· "}
                <a href={`/api/files?key=${encodeURIComponent(app.resumeKey)}`} target="_blank" rel="noreferrer" className="underline">
                  {app.resumeName ?? "Resume"}
                </a>
              </>
            )}
            {app.coverLetterKey && (
              <>
                {" Â· "}
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
            {busyNotes ? "Savingâ¦" : "Save note"}
          </button>
        </div>
      </div>
      {rejecting && (
        <div className="mt-3 rounded border border-oxide/20 bg-oxide/5 p-3">
          <p className="text-xs font-semibold text-ink/70">Reject {app.candidate.name}</p>
          {templates.length > 0 && (
            <select
              className="field mt-2 text-sm"
              value={selectedTemplateId}
              onChange={(e) => pickTemplate(e.target.value)}
              aria-label="Rejection template"
            >
              <option value="">Write your own…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <textarea
            className="field mt-2 w-full text-sm"
            rows={4}
            placeholder="Message sent to the candidate (leave blank for a generic message)"
            value={rejectionMessage}
            onChange={(e) => setRejectionMessage(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary text-sm" disabled={busyStatus} onClick={sendRejection}>
              {busyStatus ? "Sending…" : "Send rejection"}
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={busyStatus}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </li>
  );
}

export function ApplicantPipeline({
  applications,
  templates = [],
}: {
  applications: Applicant[];
  templates?: RejectionTemplate[];
}) {
  if (applications.length === 0) {
    return <p className="card text-sm text-ink/60">No applicants yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {applications.map((a) => (
        <ApplicantRow key={a.id} app={a} templates={templates} />
      ))}
    </ul>
  );
}
