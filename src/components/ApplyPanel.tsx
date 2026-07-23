"use client";

import { useState } from "react";

type UploadKind = "resume" | "coverLetter";

async function uploadFile(file: File, kind: UploadKind): Promise<{ key: string; name: string }> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: file.type }),
  });
  const data = await presign.json();
  if (!presign.ok) throw new Error(data.error ?? "Could not prepare upload");
  if (file.size > data.maxBytes) throw new Error(`File must be under ${Math.round(data.maxBytes / 1024 / 1024)} MB`);
  const put = await fetch(data.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!put.ok) throw new Error("Upload failed — try again");
  return { key: data.key, name: file.name };
}

export function ApplyPanel(props: {
  jobId: string;
  applyUrl?: string | null;
  closed: boolean;
  viewerRole: "CANDIDATE" | "EMPLOYER" | "ADMIN" | null;
  applied: boolean;
  bookmarked: boolean;
  defaultResumeKey?: string | null;
  defaultResumeName?: string | null;
  defaultCoverLetterKey?: string | null;
  defaultCoverLetterName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [bookmarked, setBookmarked] = useState(props.bookmarked);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(props.applied);
  const [busy, setBusy] = useState(false);

  // A candidate can apply with the resume/cover letter already on their
  // profile, or swap in a one-off version just for this job — either way,
  // the profile default itself is never touched (see uploadFile above,
  // which never calls /api/profile).
  const [resumeMode, setResumeMode] = useState<"profile" | "upload">(props.defaultResumeKey ? "profile" : "upload");
  const [resumeKey, setResumeKey] = useState<string | null>(props.defaultResumeKey ?? null);
  const [resumeName, setResumeName] = useState<string | null>(props.defaultResumeName ?? null);
  const [resumeUploading, setResumeUploading] = useState(false);

  const [coverLetterMode, setCoverLetterMode] = useState<"none" | "profile" | "upload">(
    props.defaultCoverLetterKey ? "profile" : "none"
  );
  const [coverLetterKey, setCoverLetterKey] = useState<string | null>(props.defaultCoverLetterKey ?? null);
  const [coverLetterName, setCoverLetterName] = useState<string | null>(props.defaultCoverLetterName ?? null);
  const [coverLetterUploading, setCoverLetterUploading] = useState(false);

  function useProfileResume() {
    setResumeMode("profile");
    setResumeKey(props.defaultResumeKey ?? null);
    setResumeName(props.defaultResumeName ?? null);
  }

  function useUploadResume() {
    setResumeMode("upload");
    setResumeKey(null);
    setResumeName(null);
  }

  async function onResumeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    setError(null);
    try {
      const { key, name } = await uploadFile(file, "resume");
      setResumeKey(key);
      setResumeName(name);
    } catch (err: any) {
      setError(err.message ?? "Resume upload failed");
    } finally {
      setResumeUploading(false);
      e.target.value = "";
    }
  }

  function onCoverLetterModeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as "none" | "profile" | "upload";
    setCoverLetterMode(v);
    if (v === "profile") {
      setCoverLetterKey(props.defaultCoverLetterKey ?? null);
      setCoverLetterName(props.defaultCoverLetterName ?? null);
    } else {
      setCoverLetterKey(null);
      setCoverLetterName(null);
    }
  }

  async function onCoverLetterFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverLetterUploading(true);
    setError(null);
    try {
      const { key, name } = await uploadFile(file, "coverLetter");
      setCoverLetterKey(key);
      setCoverLetterName(name);
    } catch (err: any) {
      setError(err.message ?? "Cover letter upload failed");
    } finally {
      setCoverLetterUploading(false);
      e.target.value = "";
    }
  }

  async function apply() {
    if (!resumeKey) {
      setError(resumeMode === "upload" ? "Choose a resume file before submitting." : "A resume is required to apply.");
      return;
    }
    if (coverLetterMode === "upload" && !coverLetterKey) {
      setError('Choose a cover letter file, or switch back to "No cover letter".');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: props.jobId,
        coverNote: coverNote || undefined,
        resumeKey,
        resumeName: resumeName || undefined,
        coverLetterKey: coverLetterMode === "none" ? null : coverLetterKey,
        coverLetterName: coverLetterMode === "none" ? null : coverLetterName || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setOpen(false);
    } else if (data.action === "UPLOAD_RESUME") {
      setError("A resume is required to apply — attach one above.");
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
          <div>
            <p className="label">Resume</p>
            <div className="space-y-1.5">
              {props.defaultResumeKey && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="resumeMode" checked={resumeMode === "profile"} onChange={useProfileResume} />
                  Use your profile resume — {props.defaultResumeName ?? "on file"}
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="resumeMode" checked={resumeMode === "upload"} onChange={useUploadResume} />
                {props.defaultResumeKey ? "Upload a different resume for this application" : "Upload your resume"}
              </label>
            </div>
            {resumeMode === "upload" && (
              <div className="mt-1.5">
                <label className="btn-ghost inline-block cursor-pointer text-sm">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={onResumeFile} className="sr-only" />
                  {resumeUploading ? "Uploading…" : resumeName ? "Replace file" : "Choose file"}
                </label>
                {resumeName && <p className="mt-1 text-xs text-patina">✓ {resumeName}</p>}
                <p className="mt-1 text-xs text-ink/50">This won&apos;t change the resume on your profile.</p>
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="coverLetterMode">Cover letter</label>
            <select id="coverLetterMode" className="field" value={coverLetterMode} onChange={onCoverLetterModeChange}>
              <option value="none">No cover letter</option>
              {props.defaultCoverLetterKey && (
                <option value="profile">Use profile cover letter — {props.defaultCoverLetterName ?? "on file"}</option>
              )}
              <option value="upload">Upload a tailored cover letter</option>
            </select>
            {coverLetterMode === "upload" && (
              <div className="mt-1.5">
                <label className="btn-ghost inline-block cursor-pointer text-sm">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={onCoverLetterFile} className="sr-only" />
                  {coverLetterUploading ? "Uploading…" : coverLetterName ? "Replace file" : "Choose file"}
                </label>
                {coverLetterName && <p className="mt-1 text-xs text-patina">✓ {coverLetterName}</p>}
              </div>
            )}
          </div>

          <label className="label" htmlFor="coverNote">Note to the employer (optional)</label>
          <textarea
            id="coverNote"
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            rows={4}
            maxLength={3000}
            className="field"
            placeholder="Tickets, availability, roster preferences…"
          />
          <button
            onClick={apply}
            disabled={busy || resumeUploading || coverLetterUploading}
            className="btn-primary w-full disabled:opacity-50"
          >
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
