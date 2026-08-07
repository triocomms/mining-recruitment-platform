"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n";

export function LoginForm({ dict }: { dict: Dictionary["login"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<string | null>(null);

  async function resendVerification() {
    if (!unverifiedEmail) return;
    setResendState("sending");
    await fetch("/api/auth/verify/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unverifiedEmail }),
    });
    setResendState("sent");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(f.get("email")),
      password: String(f.get("password")),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      if (res.error.includes("UNVERIFIED")) {
        setUnverifiedEmail(String(f.get("email")));
        setError(dict.errUnverified);
      } else {
        setUnverifiedEmail(null);
        setError(res.error.includes("SUSPENDED") ? dict.errSuspended : dict.errIncorrect);
      }
    } else {
      router.push("/dashboard/candidate");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">{dict.emailLabel}</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">{dict.passwordLabel}</label>
          <a href="/forgot-password" className="text-xs font-semibold text-oxide underline">{dict.forgotPassword}</a>
        </div>
        <input id="password" name="password" type="password" required className="field" autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-oxide" role="alert">{error}</p>}
      {unverifiedEmail && (
        <button
          type="button"
          className="btn-ghost w-full text-sm"
          disabled={resendState === "sending" || resendState === "sent"}
          onClick={resendVerification}
        >
          {resendState === "sent" ? dict.resendSent : resendState === "sending" ? dict.resendSending : dict.resendVerification}
        </button>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
        {busy ? dict.signingIn : dict.signIn}
      </button>
    </form>
  );
}
