"use client";

import { useState } from "react";
import Script from "next/script";

// Cloudflare's widget script injects a hidden `cf-turnstile-response` input
// into whichever <form> the .cf-turnstile div sits inside, so the submit
// handler below can read it straight out of FormData like any other field.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ContactForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const payload = {
      name: String(f.get("name")),
      email: String(f.get("email")),
      subject: String(f.get("subject")),
      message: String(f.get("message")),
      turnstileToken: f.get("cf-turnstile-response") ? String(f.get("cf-turnstile-response")) : undefined,
    };
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong -- please try again");
      setBusy(false);
      return;
    }
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card mt-6 text-center">
        <p className="font-display text-2xl uppercase tracking-wide">Message sent</p>
        <p className="mt-2 text-sm text-ink/70">
          Thanks for reaching out — we&rsquo;ll get back to you by email as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" required maxLength={120} className="field" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" required maxLength={150} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="message">Message</label>
        <textarea id="message" name="message" required minLength={10} maxLength={5000} rows={6} className="field" />
      </div>

      {TURNSTILE_SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="light" />
        </>
      )}

      {error && <p className="text-sm text-oxide" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
