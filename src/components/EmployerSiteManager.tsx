"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createElement as h } from "react";
import { FileUpload } from "@/components/FileUpload";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SiteGalleryUploader } from "@/components/SiteGalleryUploader";

const COMMODITIES = [
  "GOLD",
  "IRON_ORE",
  "COAL",
  "COPPER",
  "LITHIUM",
  "NICKEL",
  "BAUXITE_ALUMINA",
  "URANIUM",
  "MINERAL_SANDS",
  "RARE_EARTHS",
  "ZINC_LEAD",
  "OIL_GAS",
  "OTHER",
];

type Site = {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  region: string | null;
  city: string | null;
  commodity: string | null;
  accessType: string | null;
  rosterPatterns: string[];
  pointsOfHire: string[];
  charterOriginCities: string[];
  driveTimeFromTown: string | null;
  roomType: string | null;
  wifiNotes: string | null;
  gym: boolean;
  pool: boolean;
  foodNotes: string | null;
  otherAmenities: string | null;
  description: string | null;
  heroImageKey: string | null;
  galleryKeys: string[];
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
};

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "bg-patina/15 text-patina",
  PENDING_REVIEW: "bg-oregold/30",
  DRAFT: "",
};

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "live",
  PENDING_REVIEW: "in review",
  DRAFT: "draft",
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMPTY = {
  name: "",
  countryCode: "",
  region: "",
  city: "",
  commodity: "",
  accessType: "",
  rosterPatterns: "",
  pointsOfHire: "",
  charterOriginCities: "",
  driveTimeFromTown: "",
  roomType: "",
  wifiNotes: "",
  gym: false,
  pool: false,
  foodNotes: "",
  otherAmenities: "",
  description: "",
};

/**
 * Employer-facing "Mining sites" manager on the dashboard. Mirrors
 * AdminSiteManager's core fields (roster, access, camp/facility details),
 * plus the employer-only content fields (description, hero photo, gallery)
 * added alongside PENDING_REVIEW. Employers can never publish directly --
 * "Submit for review" moves a DRAFT to PENDING_REVIEW, and only an admin
 * (Publish/Reject on /dashboard/admin/sites) can make it live.
 */
export function EmployerSiteManager({ initialSites }: { initialSites: Site[] }) {
  const router = useRouter();
  const [sites, setSites] = useState(initialSites);
  const [editingId, setEditingId] = useState(null as string | null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [msg, setMsg] = useState(null as string | null);

  function resetForm() {
    setEditingId(null);
    setF(EMPTY);
    setMsg(null);
  }

  function startEdit(site: Site) {
    setEditingId(site.id);
    setF({
      name: site.name,
      countryCode: site.countryCode,
      region: site.region ?? "",
      city: site.city ?? "",
      commodity: site.commodity ?? "",
      accessType: site.accessType ?? "",
      rosterPatterns: site.rosterPatterns.join(", "),
      pointsOfHire: site.pointsOfHire.join(", "),
      charterOriginCities: site.charterOriginCities.join(", "),
      driveTimeFromTown: site.driveTimeFromTown ?? "",
      roomType: site.roomType ?? "",
      wifiNotes: site.wifiNotes ?? "",
      gym: site.gym,
      pool: site.pool,
      foodNotes: site.foodNotes ?? "",
      otherAmenities: site.otherAmenities ?? "",
      description: site.description ?? "",
    });
    setMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(submitForReview: boolean) {
    setBusy(true);
    setError(null);
    setMsg(null);

    const payload = {
      name: f.name,
      countryCode: f.countryCode,
      region: f.region || null,
      city: f.city || null,
      commodity: f.commodity || null,
      accessType: f.accessType || null,
      rosterPatterns: splitList(f.rosterPatterns),
      pointsOfHire: splitList(f.pointsOfHire),
      charterOriginCities: splitList(f.charterOriginCities),
      driveTimeFromTown: f.driveTimeFromTown || null,
      roomType: f.roomType || null,
      wifiNotes: f.wifiNotes || null,
      gym: f.gym,
      pool: f.pool,
      foodNotes: f.foodNotes || null,
      otherAmenities: f.otherAmenities || null,
      description: f.description || null,
      submit: submitForReview,
    };

    const url = editingId ? "/api/company/sites/" + editingId : "/api/company/sites";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save site");
      return;
    }
    if (editingId) {
      setSites((prev) => prev.map((s) => (s.id === editingId ? data.site : s)));
      setEditingId(data.site.id);
    } else {
      setSites((prev) => [data.site, ...prev]);
      // Stay in edit mode on the new site so the hero photo / gallery
      // uploaders (which need a real siteId) appear immediately.
      startEdit(data.site);
    }
    setMsg(submitForReview ? "Submitted for review" : "Saved as draft");
    router.refresh();
  }

  async function removeSite(siteId: string) {
    if (!confirm("Delete this site? Jobs linked to it will keep their own details but lose the site link.")) return;
    const res = await fetch("/api/company/sites/" + siteId, { method: "DELETE" });
    if (res.ok) setSites((prev) => prev.filter((s) => s.id !== siteId));
    if (editingId === siteId) resetForm();
  }

  const editingSite = editingId ? sites.find((s) => s.id === editingId) ?? null : null;

  return h(
    "div",
    { className: "space-y-6" },
    h(
      "form",
      { onSubmit: (e: any) => e.preventDefault(), className: "card space-y-3" },
      h(
        "p",
        { className: "text-sm text-ink/60" },
        editingId
          ? "Editing a site. Submitting for review sends it to an admin — it won't appear on the public directory until approved."
          : "Add a site your company operates. New sites start as drafts — submit for review when ready."
      ),
      editingSite &&
        h(
          "span",
          { className: `tag ${STATUS_TONE[editingSite.status]}` },
          STATUS_LABEL[editingSite.status]
        ),
      h(
        "div",
        { className: "grid gap-3 sm:grid-cols-2" },
        h("input", {
          type: "text",
          required: true,
          placeholder: "Site name (e.g. South Flank �,
          value: f.name,
          onChange: (e: any) => setF({ ...f, name: e.target.value }),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          required: true,
          maxLength: 2,
          placeholder: "Country code (e.g. AU)",
          value: f.countryCode,
          onChange: (e: any) => setF({ ...f, countryCode: e.target.value }),
          className: "field",
        }),
        h(
          "select",
          { value: f.commodity, onChange: (e: any) => setF({ ...f, commodity: e.target.value }), className: "field" },
          h("option", { value: "" }, "Commodity (optional)"),
          ...COMMODITIES.map((c) => h("option", { key: c, value: c }, c))
        ),
        h("input", {
          type: "text",
          placeholder: "Region (e.g. Pilbara, WA)",
          value: f.region,
          onChange: (e: any) => setF({ ...f, region: e.target.value }),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Nearest town/city",
          value: f.city,
          onChange: (e: any) => setF({ ...f, city: e.target.value }),
          className: "field",
        }),
        h(
          "select",
          { value: f.accessType, onChange: (e: any) => setF({ ...f, accessType: e.target.value }), className: "field" },
          h("option", { value: "" }, "Access type (optional)"),
          h("option", { value: "FIFO" }, "FIFO"),
          h("option", { value: "DIDO" }, "DIDO"),
          h("option", { value: "RESIDENTIAL" }, "Residential")
        ),
        h("input", {
          type: "text",
          placeholder: "Drive time from town (free text)",
          value: f.driveTimeFromTown,
          onChange: (e: any) => setF({ ...f, driveTimeFromTown: e.target.value }),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Roster patterns, comma separated (e.g. 8/6, 5/2)",
          value: f.rosterPatterns,
          onChange: (e: any) => setF({ ...f, rosterPatterns: e.target.value }),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Points of hire, comma separated (e.g. Perth, Karratha)",
          value: f.pointsOfHire,
          onChange: (e: any) => setF({ ...f, pointsOfHire: e.target.value }),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Charter origin cities, comma separated",
          value: f.charterOriginCities,
          onChange: (e: any) => setF({ ...f, charterOriginCities: e.target.value }),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Room type (e.g. single ensuite)",
          value: f.roomType,
          onChange: (e: any) => setF({ ...f, roomType: e.target.value }),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Wifi notes",
          value: f.wifiNotes,
          onChange: (e: any) => setF({ ...f, wifiNotes: e.target.value }),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Food notes",
          value: f.foodNotes,
          onChange: (e: any) => setF({ ...f, foodNotes: e.target.value }),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Other amenities",
          value: f.otherAmenities,
          onChange: (e: any) => setF({ ...f, otherAmenities: e.target.value }),
          className: "field sm:col-span-2",
        }),
        h(
          "label",
          { className: "flex items-center gap-2 text-sm" },
          h("input", { type: "checkbox", checked: f.gym, onChange: (e: any) => setF({ ...f, gym: e.target.checked }) }),
          "Gym"
        ),
        h(
          "label",
          { className: "flex items-center gap-2 text-sm" },
          h("input", { type: "checkbox", checked: f.pool, onChange: (e: any) => setF({ ...f, pool: e.target.checked }) }),
          "Pool"
        )
      ),
      h(
        "div",
        null,
        h("label", { className: "label" }, "About this site"),
        h(RichTextEditor, {
          className: "min-h-28",
          maxLength: 5000,
          placeholder: "What's it like working at this site? Roster rhythm, camp life, standout facilities…",
          value: f.description,
          onChange: (v: string) => setF({ ...f, description: v }),
        })
      ),
      editingSite &&
        h(
          "div",
          { className: "grid gap-4 border-t border-ink/10 pt-4 sm:grid-cols-2" },
          h(FileUpload, {
            kind: "photo",
            label: "Hero photo",
            accept: "image/*",
            field: "heroImageKey",
            endpoint: "/api/company/sites/" + editingSite.id,
            currentKey: editingSite.heroImageKey,
          }),
          h(
            "div",
            null,
            h(SiteGalleryUploader, { siteId: editingSite.id, initialKeys: editingSite.galleryKeys })
          )
        ),
      error && h("p", { className: "text-sm text-oxide" }, error),
      msg && h("p", { className: "text-sm text-patina", role: "status" }, msg),
      h(
        "div",
        { className: "flex flex-wrap gap-2" },
        h(
          "button",
          { type: "button", disabled: busy, onClick: () => submit(false), className: "btn-ghost" },
          busy ? "Saving…" : "Save as draft"
        ),
        (!editingSite || editingSite.status === "DRAFT") &&
          h(
            "button",
            { type: "button", disabled: busy, onClick: () => submit(true), className: "btn-primary" },
            busy ? "Saving…" : "Submit for review"
          ),
        editingId && h("button", { type: "button", onClick: resetForm, className: "text-sm underline" }, "Cancel / add another site")
      )
    ),
    h(
      "ul",
      { className: "space-y-3" },
      ...sites.map((site) =>
        h(
          "li",
          { key: site.id, className: "card flex flex-wrap items-start justify-between gap-3" },
          h(
            "div",
            null,
            h("p", { className: "font-display text-lg uppercase tracking-wide" }, site.name),
            h(
              "p",
              { className: "text-xs text-ink/50" },
              [site.city, site.region, site.countryCode].filter(Boolean).join(", ")
            ),
            h(
              "p",
              { className: "mt-1 text-sm text-ink/70" },
              [site.commodity, site.accessType].filter(Boolean).join(" · ") || "No commodity/access set"
            )
          ),
          h(
            "div",
            { className: "flex items-center gap-2" },
            h("span", { className: `tag ${STATUS_TONE[site.status]}` }, STATUS_LABEL[site.status]),
            h("button", { onClick: () => startEdit(site), className: "text-sm underline" }, "Edit"),
            h("button", { onClick: () => removeSite(site.id), className: "text-sm text-oxide underline" }, "Remove")
          )
        )
      ),
      sites.length === 0 && h("p", { className: "card text-sm text-ink/60" }, "No sites yet — add your first one above.")
    )
  );
}
