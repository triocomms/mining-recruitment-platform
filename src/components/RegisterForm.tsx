"use client";

import { useState } from "react";

export function RegisterForm({ defaultRole }: { defaultRole: "CANDIDATE" | "EMPLOYER" }) {
  const [role, setRole] = useState<"CANDIDATE" | "EMPLOYER">(defaultRole);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const payload = {
      role,
      email: String(f.get("email")),
      password: String(f.get("password")),
      firstName: f.get("firstName") ? String(f.get("firstName")) : undefined,
      lastName: f.get("lastName") ? String(f.get("lastName")) : undefined,
      companyName: f.get("companyName") ? String(f.get("companyName")) : undefined,
      acceptTerms: f.get("acceptTerms") === "on",
      acceptPrivacy: f.get("acceptPrivacy") === "on",
      marketingOptIn: f.get("marketingOptIn") === "on",
    };
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Registration failed");
      setBusy(false);
      return;
    }
    setBusy(false);
    setRegisteredEmail(payload.email);
  }

  if (registeredEmail) {
    return (
      <div className="card mt-6 text-center">
        <p className="font-display text-2xl uppercase tracking-wide">Check your inbox</p>
        <p className="mt-2 text-sm text-ink/70">
          We&rsquo;ve sent a verification link to <span className="font-semibold">{registeredEmail}</span>.
          Click it to activate your account, then sign in.
        </p>
        <p className="mt-3 text-xs text-ink/50">
          Nothing arriving? Check spam, or use &ldquo;Resend verification email&rdquo; on the{" "}
          <a href="/login" className="underline">sign-in page</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
        {(["CANDIDATE", "EMPLOYER"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`rounded-card border px-3 py-3 text-sm font-semibold ${
              role === r ? "border-hivis bg-hivis/10" : "border-ink/20"
            }`}
          >
            {r === "CANDIDATE" ? "I'm looking for work" : "I'm hiring"}
          </button>
        ))}
      </div>

      {role === "CANDIDATE" ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" required className="field" autoComplete="given-name" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name</label>
            <input id="lastName" name="lastName" required className="field" autoComplete="family-name" />
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="companyName">Company name</label>
          <input id="companyName" name="companyName" required className="field" autoComplete="organization" />
        </div>
      )}

      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={10} className="field" autoComplete="new-password" />
        <p className="mt-1 text-xs text-ink/50">At least 10 characters.</p>
      </div>

      <fieldset className="space-y-2 text-sm">
        <legend className="sr-only">Consent</legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5" />
          <span>I accept the <a href="/terms" className="underline">Terms of Service</a></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="acceptPrivacy" required className="mt-0.5" />
          <span>I have read the <a href="/privacy" className="underline">Privacy Policy</a> and understand how my data is used</span>
        </label>
        <label className="flex items-start gap-2 text-ink/70">
          <input type="checkbox" name="marketingOptIn" className="mt-0.5" />
          <span>Email me job alerts and industry news (optional — change anytime)</span>
        </label>
      </fieldset>

      {error && <p className="text-sm text-oxide" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
