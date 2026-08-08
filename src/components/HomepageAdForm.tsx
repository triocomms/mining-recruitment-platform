"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";

export function HomepageAdForm(props: { initial: { imageKey: string | null; linkUrl: string; enabled: boolean } }) {
  const [imageKey, setImageKey] = useState<string | null>(props.initial.imageKey);
  const [linkUrl, setLinkUrl] = useState(props.initial.linkUrl);
  const [enabled, setEnabled] = useState(props.initial.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/homepage-ad", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkUrl, enabled }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save");
      return;
    }
    setSaved(true);
  }

  const canGoLive = Boolean(imageKey && linkUrl);

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <FileUpload
          kind="homepageBanner"
          label="Banner image"
          accept="image/jpeg,image/png,image/webp"
          field="imageKey"
          endpoint="/api/admin/homepage-ad"
          currentKey={imageKey}
          onUploaded={setImageKey}
        />
        {imageKey && (
          <img
            src={`/api/files?key=${encodeURIComponent(imageKey)}`}
            alt=""
            className="mt-3 max-h-40 rounded-md border border-ink/10 object-contain"
          />
        )}
      </div>

      <div>
        <span className="label">Link URL</span>
        <input
          type="url"
          className="field"
          placeholder="https://example.com/your-landing-page"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
        <p className="mt-1 text-xs text-ink/50">Where visitors land when they click the banner. Opens in a new tab.</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Show this ad on the homepage
      </label>

      {enabled && !canGoLive && (
        <p className="text-xs text-oxide">
          Won&apos;t actually show yet — the banner needs both an image and a link URL before it goes live, even
          with this checked.
        </p>
      )}

      {error && <p className="text-sm text-oxide">{error}</p>}
      {saved && !error && <p className="text-sm text-patina">✓ Saved.</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
