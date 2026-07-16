"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Blog/news post composer with cover + gallery images.
 * Images are downscaled client-side (max 1920px, JPEG) before the presigned
 * upload so we never store raw phone-camera originals.
 */

async function downscale(file: File, maxDim = 1920, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality)
  );
}

async function uploadImage(kind: "blogCover" | "blogImage", file: File): Promise<string> {
  const blob = await downscale(file);
  const contentType = blob.type || file.type;
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType }),
  });
  const { key, url, maxBytes, error } = await presign.json();
  if (!presign.ok) throw new Error(error ?? "Upload not allowed");
  if (blob.size > maxBytes) throw new Error("Image too large even after compression");
  const put = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!put.ok) throw new Error("Upload failed — try again");
  return key;
}

type GalleryItem = { key: string; altText: string; name: string };

export function BlogComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      setCoverKey(await uploadImage("blogCover", file));
      setStatus("Cover uploaded — add alt text below.");
    } catch (err: any) {
      setStatus(err.message);
    }
    setBusy(false);
  }

  async function onGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setStatus(null);
    try {
      for (const file of files.slice(0, 12 - gallery.length)) {
        const key = await uploadImage("blogImage", file);
        setGallery((g) => [...g, { key, altText: "", name: file.name }]);
      }
    } catch (err: any) {
      setStatus(err.message);
    }
    setBusy(false);
  }

  async function submit(publish: boolean) {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        excerpt: excerpt || undefined,
        body,
        coverKey: coverKey ?? undefined,
        coverAlt: coverKey ? coverAlt : undefined,
        gallery: gallery.map(({ key, altText }) => ({ key, altText })),
        publish,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Could not save post");
      return;
    }
    router.push(publish ? `/news/${data.slug}` : "/dashboard");
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label" htmlFor="bp-title">Title</label>
        <input id="bp-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bp-excerpt">Excerpt (shown on listings)</label>
        <input id="bp-excerpt" className="field" maxLength={300} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bp-body">Body — markdown supported</label>
        <textarea id="bp-body" className="field min-h-64 font-mono text-sm" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="mt-1 text-xs text-ink/50">
          Supports ## headings, **bold**, *italic*, [links](https://…), bullet lists, and a YouTube or
          Vimeo URL on its own line for an embedded video.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Cover image</span>
          <label className="btn-ghost w-full cursor-pointer">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onCover} />
            {coverKey ? "Replace cover" : "Choose cover image"}
          </label>
          {coverKey && (
            <input
              className="field mt-2 text-sm"
              placeholder="Cover alt text (required)"
              value={coverAlt}
              onChange={(e) => setCoverAlt(e.target.value)}
            />
          )}
        </div>
        <div>
          <span className="label">Gallery images (up to 12)</span>
          <label className="btn-ghost w-full cursor-pointer">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={onGallery} />
            Add gallery images
          </label>
        </div>
      </div>

      {gallery.length > 0 && (
        <ul className="space-y-2">
          {gallery.map((g, i) => (
            <li key={g.key} className="flex items-center gap-2">
              <span className="truncate text-xs text-ink/60">{g.name}</span>
              <input
                className="field flex-1 text-sm"
                placeholder="Alt text (required)"
                value={g.altText}
                onChange={(e) =>
                  setGallery((list) => list.map((item, j) => (j === i ? { ...item, altText: e.target.value } : item)))
                }
              />
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setGallery((list) => list.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" disabled={busy} onClick={() => submit(false)}>
          Save draft
        </button>
        <button
          className="btn-primary flex-1"
          disabled={
            busy ||
            !title ||
            body.length < 50 ||
            (!!coverKey && coverAlt.trim().length < 3) ||
            gallery.some((g) => g.altText.trim().length < 3)
          }
          onClick={() => submit(true)}
        >
          {busy ? "Working…" : "Publish"}
        </button>
      </div>
      {status && <p className="text-sm text-ink/70">{status}</p>}
    </div>
  );
}
