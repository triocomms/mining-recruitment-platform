"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountSettingsForm(props: { currentEmail: string; pendingEmail: string | null }) {
  const router = useRouter();

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMsg(null);
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, currentPassword: emailPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setEmailSaving(false);
    if (res.ok) {
      setEmailMsg({ ok: true, text: `Check ${data.pendingEmail} for a confirmation link — your login email won't change until you click it.` });
      setNewEmail("");
      setEmailPassword("");
      router.refresh();
    } else {
      setEmailMsg({ ok: false, text: data.error ?? "Could not request email change" });
    }
  }

  async function cancelPendingEmail() {
    setCancelling(true);
    setEmailMsg(null);
    const res = await fetch("/api/account/email", { method: "DELETE" });
    setCancelling(false);
    if (res.ok) {
      setEmailMsg({ ok: true, text: "Pending email change cancelled." });
      router.refresh();
    } else {
      setEmailMsg({ ok: false, text: "Could not cancel — try again" });
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "New password and confirmation don't match" });
      return;
    }
    setPasswordSaving(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setPasswordSaving(false);
    if (res.ok) {
      setPasswordMsg({ ok: true, text: "Password updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordMsg({ ok: false, text: data.error ?? "Could not update password" });
    }
  }

  return (
    <div className="space-y-8">
      <section className="card">
        <h2 className="font-display text-xl uppercase tracking-wide">Login email</h2>
        <p className="mt-1 text-sm text-ink/60">
          Currently <span className="font-semibold">{props.currentEmail}</span>.
        </p>

        {props.pendingEmail && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-oregold/40 bg-oregold/10 px-3 py-2 text-sm">
            <span>
              Confirmation pending for <span className="font-semibold">{props.pendingEmail}</span> — check that
              inbox for the link.
            </span>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={cancelPendingEmail} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        )}

        <form onSubmit={submitEmail} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="newEmail">New email</label>
            <input
              id="newEmail"
              type="email"
              required
              className="field"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="emailPassword">Current password</label>
            <input
              id="emailPassword"
              type="password"
              required
              autoComplete="current-password"
              className="field"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={emailSaving}>
              {emailSaving ? "Sending…" : "Send confirmation link"}
            </button>
          </div>
          {emailMsg && (
            <p className={`sm:col-span-2 text-sm ${emailMsg.ok ? "text-patina" : "text-oxide"}`} role="status">
              {emailMsg.text}
            </p>
          )}
        </form>
        <p className="mt-3 text-xs text-ink/50">
          We&rsquo;ll email a confirmation link to the new address, and a heads-up to your current one, so nobody
          can quietly redirect your login without you noticing.
        </p>
      </section>

      <section className="card">
        <h2 className="font-display text-xl uppercase tracking-wide">Password</h2>
        <form onSubmit={submitPassword} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="field sm:max-w-xs"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="field"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={passwordSaving}>
              {passwordSaving ? "Saving…" : "Update password"}
            </button>
          </div>
          {passwordMsg && (
            <p className={`sm:col-span-2 text-sm ${passwordMsg.ok ? "text-patina" : "text-oxide"}`} role="status">
              {passwordMsg.text}
            </p>
          )}
        </form>
        <p className="mt-3 text-xs text-ink/50">At least 10 characters. You&rsquo;ll keep using this session — you won&rsquo;t be signed out.</p>
      </section>
    </div>
  );
}
