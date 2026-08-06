"use client";

import { useState } from "react";
import { createElement as h } from "react";

const MAX_GALLERY_IMAGES = 6;

/**
 * Multi-photo uploader for a single MiningSite's gallery. Same shape as
 * CompanyGalleryUploader (Company.galleryKeys) but posts to the
 * site-scoped /api/company/sites/[siteId]/gallery route instead.
 */
export function SiteGalleryUploader(props: { siteId: string; initialKeys: string[] }) {
    const [keys, setKeys] = useState(props.initialKeys);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null as string | null);

  async function onChange(e: any) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
                const presign = await fetch("/api/uploads/presign", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ kind: "companyMedia", contentType: file.type }),
                });
                const { key, url, fields, maxBytes, error: presignError } = await presign.json();
                if (!presign.ok) throw new Error(presignError);
                if (file.size > maxBytes) throw new Error(`File must be under ${Math.round(maxBytes / 1024 / 1024)} MB`);

          const formData = new FormData();
                Object.entries(fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v));
                formData.append("file", file);
                const put = await fetch(url, { method: "POST", body: formData });
                if (!put.ok) throw new Error("Upload failed — try again");

          const save = await fetch(`/api/company/sites/${props.siteId}/gallery`, {
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
                const res = await fetch(`/api/company/sites/${props.siteId}/gallery?key=${encodeURIComponent(key)}`, {
                          method: "DELETE",
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error ?? "Could not remove photo");
                setKeys(data.galleryKeys ?? keys.filter((k) => k !== key));
        } catch (err: any) {
                setError(err.message ?? "Could not remove photo");
        } finally {
                setBusy(false);
        }
  }

  return h(
        "div",
        null,
        h("span", { className: "label" }, `Photo gallery (${keys.length}/${MAX_GALLERY_IMAGES})`),
        keys.length > 0 &&
          h(
                    "div",
            { className: "mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6" },
                    ...keys.map((key) =>
                                h(
                                              "div",
                                  { key, className: "group relative aspect-square overflow-hidden rounded-md border border-ink/10" },
                                              h("img", { src: `/api/files?key=${encodeURIComponent(key)}`, alt: "", className: "h-full w-full object-cover" }),
                                              h(
                                                              "button",
                                                {
                                                                  type: "button",
                                                                  onClick: () => remove(key),
                                                                  disabled: busy,
                                                                  className: "absolute inset-x-0 bottom-0 bg-ink/70 py-1 text-xs text-white opacity-0 group-hover:opacity-100",
                                                },
                                                              "Remove"
                                                            )
                                            )
                                        )
                  ),
        keys.length < MAX_GALLERY_IMAGES &&
          h(
                    "label",
            { className: "btn-ghost mt-2 inline-block cursor-pointer" },
                    h("input", { type: "file", accept: "image/*", onChange, className: "sr-only", disabled: busy }),
                    busy ? "Uploading…" : "Add photo"
                  ),
        error && h("p", { className: "mt-1 text-xs text-oxide" }, error)
      );
}
