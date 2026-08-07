"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n";

type UploadKind = "resume" | "coverLetter";
type ApplyDict = Dictionary["apply"];

async function uploadFile(file: File, kind: UploadKind, dict: ApplyDict): Promise<{ key: string; name: string }> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: file.type }),
  });
  const data = await presign.json();
  if (!presign.ok) throw new Error(data.error ?? dict.errCouldNotPrepareUpload);
  // Fast, friendly pre-check — the real limit is the content-length-range
  // condition S3 enforces on the presigned POST below.
  if (file.size > data.maxBytes) throw new Error(dict.errFileTooLarge(Math.round(data.maxBytes / 1024 / 1024)));
  const formData = new FormData();
  Object.entries(data.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v));
  formData.append("file", file);
  const put = await fetch(data.url, { method: "POST", body: formData });
  if (!put.ok) throw new Error(dict.errUploadFailed);
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
  dict: ApplyDict;
}) {
  const { dict } = props;
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
      const { key, name } = await uploadFile(file, "resume", dict);
      setResumeKey(key);
      setResumeName(name);
    } catch (err: any) {
      setError(err.message ?? dict.errResumeUploadFailed);
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
      const { key, name } = await uploadFile(file, "coverLetter", dict);
      setCoverLetterKey(key);
      setCoverLetterName(name);
    } catch (err: any) {
      setError(err.message ?? dict.errCoverLetterUploadFailed);
    } finally {
      setCoverLetterUploading(false);
      e.target.value = "";
    }
  }

  async function apply() {
    if (!resumeKey) {
      setError(resumeMode === "upload" ? dict.errChooseResumeFile : dict.errResumeRequired);
      return;
    }
    if (coverLetterMode === "upload" && !coverLetterKey) {
      setError(dict.errChooseCoverLetterFile);
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
      setError(dict.errResumeRequiredAttach);
    } else {
      setError(data.error ?? dict.errGeneric);
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

  if (props.closed) return <div className="card text-sm text-ink/60">{dict.closed}</div>;

  if (!props.viewerRole) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-ink/70">{dict.signInPrompt}</p>
        <a href="/register?role=candidate" className="btn-primary w-full">{dict.createFreeProfile}</a>
        <a href="/login" className="btn-ghost w-full">{dict.signIn}</a>
      </div>
    );
  }

  if (props.viewerRole !== "CANDIDATE") {
    return <div className="card text-sm text-ink/60">{dict.employerGate}</div>;
  }

  return (
    <div className="card space-y-3">
      {done ? (
        <p className="rounded-card bg-patina/10 p-3 text-sm font-medium text-patina">
          {dict.done}
        </p>
      ) : props.applyUrl ? (
        <a href={props.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
          {dict.applyOnCompanySite}
        </a>
      ) : open ? (
        <>
          <div>
            <p className="label">{dict.resumeLabel}</p>
            <div className="space-y-1.5">
              {props.defaultResumeKey && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="resumeMode" checked={resumeMode === "profile"} onChange={useProfileResume} />
                  {dict.useProfileResumePrefix}{props.defaultResumeName ?? dict.onFile}
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="resumeMode" checked={resumeMode === "upload"} onChange={useUploadResume} />
                {props.defaultResumeKey ? dict.uploadDifferentResume : dict.uploadYourResume}
              </label>
            </div>
            {resumeMode === "upload" && (
              <div className="mt-1.5">
                <label className="btn-ghost inline-block cursor-pointer text-sm">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={onResumeFile} className="sr-only" />
                  {resumeUploading ? dict.uploading : resumeName ? dict.replaceFile : dict.chooseFile}
                </label>
                {resumeName && <p className="mt-1 text-xs text-patina">✓ {resumeName}</p>}
                <p className="mt-1 text-xs text-ink/50">{dict.resumeUploadNote}</p>
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="coverLetterMode">{dict.coverLetterLabel}</label>
            <select id="coverLetterMode" className="field" value={coverLetterMode} onChange={onCoverLetterModeChange}>
              <option value="none">{dict.noCoverLetter}</option>
              {props.defaultCoverLetterKey && (
                <option value="profile">{dict.useProfileCoverLetterPrefix}{props.defaultCoverLetterName ?? dict.onFile}</option>
              )}
              <option value="upload">{dict.uploadTailoredCoverLetter}</option>
            </select>
            {coverLetterMode === "upload" && (
              <div className="mt-1.5">
                <label className="btn-ghost inline-block cursor-pointer text-sm">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={onCoverLetterFile} className="sr-only" />
                  {coverLetterUploading ? dict.uploading : coverLetterName ? dict.replaceFile : dict.chooseFile}
                </label>
                {coverLetterName && <p className="mt-1 text-xs text-patina">✓ {coverLetterName}</p>}
              </div>
            )}
          </div>

          <label className="label" htmlFor="coverNote">{dict.noteToEmployer}</label>
          <textarea
            id="coverNote"
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            rows={4}
            maxLength={3000}
            className="field"
            placeholder={dict.notePlaceholder}
          />
          <button
            onClick={apply}
            disabled={busy || resumeUploading || coverLetterUploading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {busy ? dict.submitting : dict.submitApplication}
          </button>
        </>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">{dict.applyNow}</button>
      )}
      {error && <p className="text-sm text-oxide">{error}</p>}
      <button onClick={toggleBookmark} className="btn-ghost w-full">
        {bookmarked ? dict.saved : dict.saveJob}
      </button>
      <p className="text-xs text-ink/50">{dict.resumeShareDisclaimer}</p>
    </div>
  );
}
