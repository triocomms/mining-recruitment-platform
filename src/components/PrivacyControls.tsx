"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function PrivacyControls(props: { visibility: string }) {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  async function requestDeletion(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/privacy/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirmation: confirmText }),
    });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Deletion failed");
    setDeleting(false);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="card">
        <h2 className="font-semibold">Export your data</h2>
        <p className="mt-1 text-sm text-ink/60">
          Download a machine-readable JSON bundle of your profile, applications, messages, bookmarks,
          and consent history (GDPR Art. 20 data portability).
        </p>
        {/* Plain link so the browser handles the file download natively */}
        <a href="/api/privacy/export" className="btn-ghost mt-3 inline-block" download>
          Download my data (JSON)
        </a>
      </div>

      <div className="card">
        <h2 className="font-semibold">Profile visibility</h2>
        <p className="mt-1 text-sm text-ink/60">
          Currently: <strong>{props.visibility === "PUBLIC" ? "open to verified employers" : "private"}</strong>.
          Change this on your <a href="/dashboard/candidate/profile" className="underline">profile page</a> —
          every change is recorded in your consent history below.
        </p>
      </div>

      <div className="card border-oxide/40">
        <h2 className="font-semibold text-oxide">Delete your account</h2>
        <p className="mt-1 text-sm text-ink/60">
          Permanently erases your profile, resume and uploaded files, applications, and bookmarks.
          Your messages to others are replaced with a removal notice. This cannot be undone.
        </p>
        {!showDelete ? (
          <button className="btn-ghost mt-3 border-oxide/40 text-oxide" onClick={() => setShowDelete(true)}>
            Start deletion…
          </button>
        ) : (
          <form onSubmit={requestDeletion} className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="del-pass">Your password</label>
              <input
                id="del-pass"
                type="password"
                className="field"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="del-confirm">
                Type <span className="font-mono font-semibold">DELETE MY ACCOUNT</span> to confirm
              </label>
              <input
                id="del-confirm"
                className="field"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-oxide">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary bg-oxide"
                disabled={deleting || confirmText !== "DELETE MY ACCOUNT"}
              >
                {deleting ? "Erasing…" : "Permanently delete"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowDelete(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
