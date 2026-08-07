"use client";

import { useState } from "react";
import Script from "next/script";
import type { Dictionary } from "@/lib/i18n";

// Cloudflare's widget script injects a hidden `cf-turnstile-response` input
// into whichever <form> the .cf-turnstile div sits inside, so the submit
// handler below can read it straight out of FormData like any other field.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function RegisterForm({
  defaultRole,
  dict,
}: {
  defaultRole: "CANDIDATE" | "EMPLOYER";
  dict: Dictionary["register"];
}) {
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
      turnstileToken: f.get("cf-turnstile-response") ? String(f.get("cf-turnstile-response")) : undefined,
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
        <p className="font-display text-2xl uppercase tracking-wide">{dict.checkInbox}</p>
        <p className="mt-2 text-sm text-ink/70">
          {dict.verificationSentPre}<span className="font-semibold">{registeredEmail}</span>
          {dict.verificationSentPost}
        </p>
        <p className="mt-3 text-xs text-ink/50">
          {dict.nothingArrivingPre}
          <a href="/login" className="underline">{dict.signInPageLink}</a>
          {dict.nothingArrivingPost}
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
            {r === "CANDIDATE" ? dict.imLookingForWork : dict.imHiring}
          </button>
        ))}
      </div>

      {role === "CANDIDATE" ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="firstName">{dict.firstName}</label>
            <input id="firstName" name="firstName" required className="field" autoComplete="given-name" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">{dict.lastName}</label>
            <input id="lastName" name="lastName" required className="field" autoComplete="family-name" />
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="companyName">{dict.companyName}</label>
          <input id="companyName" name="companyName" required className="field" autoComplete="organization" />
        </div>
      )}

      <div>
        <label className="label" htmlFor="email">{dict.email}</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">{dict.password}</label>
        <input id="password" name="password" type="password" required minLength={10} className="field" autoComplete="new-password" />
        <p className="mt-1 text-xs text-ink/50">{dict.passwordHint}</p>
      </div>

      <fieldset className="space-y-2 text-sm">
        <legend className="sr-only">Consent</legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5" />
          <span>{dict.acceptTermsPre}<a href="/terms" className="underline">{dict.termsOfService}</a></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="acceptPrivacy" required className="mt-0.5" />
          <span>{dict.acceptPrivacyPre}<a href="/privacy" className="underline">{dict.privacyPolicy}</a>{dict.acceptPrivacyPost}</span>
        </label>
        <label className="flex items-start gap-2 text-ink/70">
          <input type="checkbox" name="marketingOptIn" className="mt-0.5" />
          <span>{dict.marketingOptIn}</span>
        </label>
      </fieldset>

      {TURNSTILE_SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="light" />
        </>
      )}

      {error && <p className="text-sm text-oxide" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
        {busy ? dict.creatingAccount : dict.createAccount}
      </button>
    </form>
  );
}
