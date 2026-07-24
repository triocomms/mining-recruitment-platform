"use client";

import { useState } from "react";

/**
 * Direct-to-S3 upload via a presigned URL, then reports the storage key
 * back to the given endpoint field. Files never touch the app server.
 */
export function FileUpload(props: {
  kind: "resume" | "coverLetter" | "photo" | "logo" | "kyb" | "certification";
  label: string;
  accept: string;
  field: string; // e.g. "resumeKey"
  nameField?: string; // e.g. "resumeName" — also persists the original filename
  endpoint: string; // e.g. "/api/profile"
  currentKey?: string | null;
  currentName?: string | null;
}) {
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">(
    props.currentKey ? "done" : "idle"
  );
  const [message, setMessage] = useState<string | null>(props.currentName ?? null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("uploading");
    setMessage(null);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: props.kind, contentType: file.type }),
      });
      const { key, url, fields, maxBytes, error } = await presign.json();
      if (!presign.ok) throw new Error(error);
      // Client-side check for a fast, friendly error message — the real
      // limit is the content-length-range condition S3 enforces on the
      // presigned POST below, so this can't be bypassed by skipping it.
      if (file.size > maxBytes) throw new Error(`File must be under ${Math.round(maxBytes / 1024 / 1024)} MB`);

      const formData = new FormData();
      Object.entries(fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v));
      formData.append("file", file);
      const put = await fetch(url, { method: "POST", body: formData });
      if (!put.ok) throw new Error("Upload failed — try again");

      const save = await fetch(props.endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [props.field]: key, ...(props.nameField ? { [props.nameField]: file.name } : {}) }),
      });
      if (!save.ok) throw new Error("Could not save file to your profile");
      setState("done");
      setMessage(file.name);
    } catch (err: any) {
      setState("error");
      setMessage(err.message ?? "Upload failed");
    }
  }

  return (
    <div>
      <span className="label">{props.label}</span>
      <label className="btn-ghost w-full cursor-pointer">
        <input type="file" accept={props.accept} onChange={onChange} className="sr-only" />
        {state === "uploading" ? "Uploading…" : state === "done" ? "Replace file" : "Choose file"}
      </label>
      {state === "done" && <p className="mt-1 text-xs text-patina">✓ {message ?? "File on record"}</p>}
      {state === "error" && <p className="mt-1 text-xs text-oxide">{message}</p>}
    </div>
  );
}
