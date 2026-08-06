"use client";

import { useState } from "react";
import { createElement as h } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload";
import { CompanyGalleryUploader } from "@/components/CompanyGalleryUploader";
import { RichTextEditor } from "@/components/RichTextEditor";

export function CompanyForm(props: {
    initial: {
          name: string;
          website: string;
          description: string;
          countryCode: string;
          size: string;
          logoKey: string | null;
          galleryKeys: string[];
          videoUrl: string;
          ratingsEnabled: boolean;
    };
}) {
    const router = useRouter();
    const [f, setF] = useState(props.initial);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMsg(null);
        const res = await fetch("/api/company", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                          name: f.name,
                          website: f.website || null,
                          description: f.description || null,
                          countryCode: f.countryCode ? f.countryCode.toUpperCase() : null,
                          size: f.size || null,
                          videoUrl: f.videoUrl || null,
                          ratingsEnabled: f.ratingsEnabled,
                }),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (res.ok) {
                setMsg({ ok: true, text: "Company details saved" });
                router.refresh();
        } else {
                setMsg({ ok: false, text: data.error ?? "Could not save" });
        }
  }

  return h(
        "form",
    { onSubmit: save, className: "card space-y-4" },
        h(
                "div",
          { className: "grid gap-4 sm:grid-cols-2" },
                h(
                          "div",
                          null,
                          h("label", { className: "label", htmlFor: "co-name" }, "Company name"),
                          h("input", {
                                      id: "co-name",
                                      className: "field",
                                      required: true,
                                      value: f.name,
                                      onChange: (e: any) => setF({ ...f, name: e.target.value }),
                          })
                        ),
                h(
                          "div",
                          null,
                          h("label", { className: "label", htmlFor: "co-web" }, "Website"),
                          h("input", {
                                      id: "co-web",
                                      type: "url",
                                      className: "field",
                                      placeholder: "https://",
                                      value: f.website,
                                      onChange: (e: any) => setF({ ...f, website: e.target.value }),
                          })
                        )
              ),
        h(
                "div",
                null,
                h("label", { className: "label", htmlFor: "co-desc" }, "About the company"),
                h(RichTextEditor, {
                          id: "co-desc",
                          className: "min-h-28",
                          maxLength: 5000,
                          value: f.description,
                          onChange: (v: string) => setF({ ...f, description: v }),
                })
              ),
        h(
                "div",
          { className: "grid gap-4 sm:grid-cols-3" },
                h(
                          "div",
                          null,
                          h("label", { className: "label", htmlFor: "co-cc" }, "HQ country (ISO code)"),
                          h("input", {
                                      id: "co-cc",
                                      className: "field uppercase",
                                      maxLength: 2,
                                      placeholder: "AU",
                                      value: f.countryCode,
                                      onChange: (e: any) => setF({ ...f, countryCode: e.target.value }),
                          })
                        ),
                h(
                          "div",
                          null,
                          h("label", { className: "label", htmlFor: "co-size" }, "Company size"),
                          h(
                                      "select",
                            {
                                          id: "co-size",
                                          className: "field",
                                          value: f.size,
                                          onChange: (e: any) => setF({ ...f, size: e.target.value }),
                            },
                                      h("option", { value: "" }, "Prefer not to say"),
                                      h("option", null, "1–10"),
                                      h("option", null, "11–50"),
                                      h("option", null, "51–200"),
                                      h("option", null, "201–1000"),
                                      h("option", null, "1000+")
                                    )
                        ),
                h(FileUpload, {
                          kind: "logo",
                          label: "Company logo",
                          accept: "image/*",
                          field: "logoKey",
                          endpoint: "/api/company",
                          currentKey: f.logoKey,
                })
              ),

        h(
                "div",
          { className: "border-t border-ink/10 pt-4" },
                h("p", { className: "label" }, "Branding media"),
                h(
                          "p",
                  { className: "mt-1 text-xs text-ink/50" },
                          "Shown on your public company page to help candidates picture working with you."
                        ),
                h(
                          "div",
                  { className: "mt-3" },
                          h("label", { className: "label", htmlFor: "co-video" }, "Video link (YouTube or Vimeo, optional)"),
                          h("input", {
                                      id: "co-video",
                                      type: "url",
                                      className: "field",
                                      placeholder: "https://www.youtube.com/watch?v=...",
                                      value: f.videoUrl,
                                      onChange: (e: any) => setF({ ...f, videoUrl: e.target.value }),
                          })
                        ),
                h(
                          "div",
                  { className: "mt-3" },
                          h(CompanyGalleryUploader, { initialKeys: props.initial.galleryKeys })
                        )
              ),

        h(
                "div",
          { className: "border-t border-ink/10 pt-4" },
                h("p", { className: "label" }, "Candidate ratings"),
                h(
                          "label",
                  { className: "mt-2 flex items-start gap-2 text-sm text-ink/80" },
                          h("input", {
                                      type: "checkbox",
                                      className: "mt-0.5",
                                      checked: f.ratingsEnabled,
                                      onChange: (e: any) => setF({ ...f, ratingsEnabled: e.target.checked }),
                          }),
                          h(
                                      "span",
                                      null,
                                      "Show candidate ratings on your public company page",
                                      h(
                                                    "span",
                                        { className: "block text-xs text-ink/50" },
                                                    "Candidates who've reached interview stage can rate you 1–5 on roster & rotation, accommodation, food, downtime & facilities, travel & logistics, and safety culture."
                                                  )
                                    )
                        )
              ),

        msg && h("p", { className: `text-sm ${msg.ok ? "text-patina" : "text-oxide"}`, role: "status" }, msg.text),
        h("button", { type: "submit", className: "btn-primary", disabled: saving }, saving ? "Saving…" : "Save details")
      );
}
