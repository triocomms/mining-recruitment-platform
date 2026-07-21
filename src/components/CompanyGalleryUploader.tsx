"use client";

import { useState } from "react";

const MAX_GALLERY_IMAGES = 6;

/**
 * Multi-photo uploader for the company page gallery. Unlike FileUpload
 * (single key, replace-on-upload), this appends to Company.galleryKeys via
 * /api/company/gallery — each photo goes through the same direct-to-S3
 * presign flow, then the returned key is posted to the array endpoint.
 */
export function CompanyGalleryUploader({ initialKeys }: { initialKeys: string[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "companyMedia", contentType: file.type }),
      });
      const { key, url, maxBytes, error: presignError } = await presign.json();
      if (!presign.ok) throw new Error(presignError);
      if (file.size > maxBytes) throw new Error(`File must be under ${Math.round(maxBytes / 1024 / 1024)} MB`);

      const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Upload failed — try again");

      const save = await fetch("/api/company/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await save.json().catch(() => ({}));
      if (!save.ok) throw new Error(data.error ?? "Could not save photo");
      setKeys(data.galleryKeys ?? [...keys, key]);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(key: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/gallery?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not remove photo");
      setKeys(data.galleryKeys ?? keys.filter((k) => k !== key));
    } catch (err: any) {
      setError(err.message ?? "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="label">Photo gallery ({keys.length}/{MAX_GALLERY_IMAGES})</span>
      {keys.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {keys.map((key) => (
            <div key={key} className="group relative aspect-square overflow-hidden rounded-md border border-ink/10">
              <img src={`/api/files?key=${encodeURIComponent(key)}`} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(key)}
                disabled={busy}
                className="absolute inset-x-0 bottom-0 bg-ink/70 py-1 text-xs text-white opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {keys.length < MAX_GALLERY_IMAGES && (
        <label className="btn-ghost mt-2 inline-block cursor-pointer">
          <input type="file" accept="image/*" onChange={onChange} className="sr-only" disabled={busy} />
          {busy ? "Uploading…" : "Add photo"}
        </label>
      )}
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
    </div>
  );
}
