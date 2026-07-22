"use client";

import { useState } from "react";

/**
 * Simple, no-backend "share this job" (site audit's cheapest recommended
 * acquisition-loop fix) — native Web Share API where supported (mobile
 * Safari/Chrome), falling back to a small inline panel of direct share
 * links. No new schema or API route: every option here just builds a
 * URL/mailto/share-intent from the page's own canonical link at click time.
 */
export function ShareJobButton({ title, companyName }: { title: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getUrl = () => (typeof window !== "undefined" ? window.location.href : "");

  async function handleClick() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${title} — ${companyName}`, url: getUrl() });
      } catch {
        // User cancelled the native share sheet, or the browser rejected the
        // call (e.g. not a user gesture in some edge case) — either way,
        // nothing else to do here.
      }
      return;
    }
    setOpen((o) => !o);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the direct share links below still work.
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleClick} className="text-xs text-ink/40 underline">
        Share this job
      </button>
    );
  }

  const shareText = encodeURIComponent(`${title} at ${companyName}`);
  const shareUrl = encodeURIComponent(getUrl());

  return (
    <div className="card space-y-2 text-sm">
      <p className="font-semibold">Share this job</p>
      <button type="button" onClick={copyLink} className="block w-full text-left text-xs underline">
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
        target="_blank"
        rel="noreferrer"
        className="block text-xs underline"
      >
        Share on LinkedIn
      </a>
      <a
        href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
        target="_blank"
        rel="noreferrer"
        className="block text-xs underline"
      >
        Share on WhatsApp
      </a>
      <a href={`mailto:?subject=${shareText}&body=${shareUrl}`} className="block text-xs underline">
        Share by email
      </a>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost w-full text-sm">
        Close
      </button>
    </div>
  );
}
