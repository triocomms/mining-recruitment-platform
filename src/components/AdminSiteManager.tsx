"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createElement as h } from "react";

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
  ratingsEnabled: boolean;
  operatorCompany: { id: string; name: string; slug: string } | null;
};

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "bg-patina/15 text-patina",
  PENDING_REVIEW: "bg-oregold/30",
  DRAFT: "",
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AdminSiteManager({ initialSites }: { initialSites: Site[] }) {
  const router = useRouter();
  const [sites, setSites] = useState(initialSites);
  const [editingId, setEditingId] = useState(null as string | null);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [commodity, setCommodity] = useState("");
  const [accessType, setAccessType] = useState("");
  const [rosterPatterns, setRosterPatterns] = useState("");
  const [pointsOfHire, setPointsOfHire] = useState("");
  const [charterOriginCities, setCharterOriginCities] = useState("");
  const [driveTimeFromTown, setDriveTimeFromTown] = useState("");
  const [roomType, setRoomType] = useState("");
  const [wifiNotes, setWifiNotes] = useState("");
  const [gym, setGym] = useState(false);
  const [pool, setPool] = useState(false);
  const [ratingsEnabled, setRatingsEnabled] = useState(true);
  const [foodNotes, setFoodNotes] = useState("");
  const [otherAmenities, setOtherAmenities] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null as string | null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCountryCode("");
    setRegion("");
    setCity("");
    setCommodity("");
    setAccessType("");
    setRosterPatterns("");
    setPointsOfHire("");
    setCharterOriginCities("");
    setDriveTimeFromTown("");
    setRoomType("");
    setWifiNotes("");
    setGym(false);
    setPool(false);
    setRatingsEnabled(true);
    setFoodNotes("");
    setOtherAmenities("");
  }

  function startEdit(site: Site) {
    setEditingId(site.id);
    setName(site.name);
    setCountryCode(site.countryCode);
    setRegion(site.region ?? "");
    setCity(site.city ?? "");
    setCommodity(site.commodity ?? "");
    setAccessType(site.accessType ?? "");
    setRosterPatterns(site.rosterPatterns.join(", "));
    setPointsOfHire(site.pointsOfHire.join(", "));
    setCharterOriginCities(site.charterOriginCities.join(", "));
    setDriveTimeFromTown(site.driveTimeFromTown ?? "");
    setRoomType(site.roomType ?? "");
    setWifiNotes(site.wifiNotes ?? "");
    setGym(site.gym);
    setPool(site.pool);
    setRatingsEnabled(site.ratingsEnabled);
    setFoodNotes(site.foodNotes ?? "");
    setOtherAmenities(site.otherAmenities ?? "");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      name,
      countryCode,
      region: region || undefined,
      city: city || undefined,
      commodity: commodity || undefined,
      accessType: accessType || undefined,
      rosterPatterns: splitList(rosterPatterns),
      pointsOfHire: splitList(pointsOfHire),
      charterOriginCities: splitList(charterOriginCities),
      driveTimeFromTown: driveTimeFromTown || undefined,
      roomType: roomType || undefined,
      wifiNotes: wifiNotes || undefined,
      gym,
      pool,
      ratingsEnabled,
      foodNotes: foodNotes || undefined,
      otherAmenities: otherAmenities || undefined,
    };

    const url = editingId ? "/api/admin/sites/" + editingId : "/api/admin/sites";
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
    } else {
      setSites((prev) => [data.site, ...prev]);
    }
    resetForm();
    router.refresh();
  }

  // Explicit status transition rather than a DRAFT<->PUBLISHED toggle, so a
  // PENDING_REVIEW submission (employer-created/edited, see EmployerSiteManager)
  // gets a real Approve/Reject decision instead of silently collapsing into
  // whichever of the two the old binary toggle happened to pick.
  async function setStatus(site: Site, status: "DRAFT" | "PUBLISHED") {
    const res = await fetch("/api/admin/sites/" + site.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSites((prev) => prev.map((s) => (s.id === site.id ? data.site : s)));
  }

  async function toggleRatings(site: Site) {
    const res = await fetch("/api/admin/sites/" + site.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratingsEnabled: !site.ratingsEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSites((prev) => prev.map((s) => (s.id === site.id ? data.site : s)));
  }

  async function removeSite(siteId: string) {
    if (!confirm("Delete this site? Jobs linked to it will keep their own details but lose the site link.")) return;
    const res = await fetch("/api/admin/sites/" + siteId, { method: "DELETE" });
    if (res.ok) setSites((prev) => prev.filter((s) => s.id !== siteId));
    if (editingId === siteId) resetForm();
  }

  return h(
    "div",
    { className: "space-y-6" },
    h(
      "form",
      { onSubmit: submit, className: "card space-y-3" },
      h(
        "p",
        { className: "text-sm text-ink/60" },
        editingId
          ? "Editing an existing site. Save changes or cancel below."
          : "Add a mining site's roster, access and camp details. Fields left blank can be filled in later."
      ),
      h(
        "div",
        { className: "grid gap-3 sm:grid-cols-2" },
        h("input", {
          type: "text",
          required: true,
          placeholder: "Site name (e.g. South Flank)",
          value: name,
          onChange: (e: any) => setName(e.target.value),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          required: true,
          maxLength: 2,
          placeholder: "Country code (e.g. AU)",
          value: countryCode,
          onChange: (e: any) => setCountryCode(e.target.value),
          className: "field",
        }),
        h(
          "select",
          { value: commodity, onChange: (e: any) => setCommodity(e.target.value), className: "field" },
          h("option", { value: "" }, "Commodity (optional)"),
          ...COMMODITIES.map((c) => h("option", { key: c, value: c }, c))
        ),
        h("input", {
          type: "text",
          placeholder: "Region (e.g. Pilbara, WA)",
          value: region,
          onChange: (e: any) => setRegion(e.target.value),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Nearest town/city",
          value: city,
          onChange: (e: any) => setCity(e.target.value),
          className: "field",
        }),
        h(
          "select",
          { value: accessType, onChange: (e: any) => setAccessType(e.target.value), className: "field" },
          h("option", { value: "" }, "Access type (optional)"),
          h("option", { value: "FIFO" }, "FIFO"),
          h("option", { value: "DIDO" }, "DIDO"),
          h("option", { value: "RESIDENTIAL" }, "Residential")
        ),
        h("input", {
          type: "text",
          placeholder: "Drive time from town (free text)",
          value: driveTimeFromTown,
          onChange: (e: any) => setDriveTimeFromTown(e.target.value),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Roster patterns, comma separated (e.g. 8/6, 5/2)",
          value: rosterPatterns,
          onChange: (e: any) => setRosterPatterns(e.target.value),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Points of hire, comma separated (e.g. Perth, Karratha)",
          value: pointsOfHire,
          onChange: (e: any) => setPointsOfHire(e.target.value),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Charter origin cities, comma separated",
          value: charterOriginCities,
          onChange: (e: any) => setCharterOriginCities(e.target.value),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Room type (e.g. single ensuite)",
          value: roomType,
          onChange: (e: any) => setRoomType(e.target.value),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Wifi notes",
          value: wifiNotes,
          onChange: (e: any) => setWifiNotes(e.target.value),
          className: "field",
        }),
        h("input", {
          type: "text",
          placeholder: "Food notes",
          value: foodNotes,
          onChange: (e: any) => setFoodNotes(e.target.value),
          className: "field sm:col-span-2",
        }),
        h("input", {
          type: "text",
          placeholder: "Other amenities",
          value: otherAmenities,
          onChange: (e: any) => setOtherAmenities(e.target.value),
          className: "field sm:col-span-2",
        }),
        h(
          "label",
          { className: "flex items-center gap-2 text-sm" },
          h("input", { type: "checkbox", checked: gym, onChange: (e: any) => setGym(e.target.checked) }),
          "Gym"
        ),
        h(
          "label",
          { className: "flex items-center gap-2 text-sm" },
          h("input", { type: "checkbox", checked: pool, onChange: (e: any) => setPool(e.target.checked) }),
          "Pool"
        ),
        h(
          "label",
          { className: "flex items-center gap-2 text-sm sm:col-span-2" },
          h("input", {
            type: "checkbox",
            checked: ratingsEnabled,
            onChange: (e: any) => setRatingsEnabled(e.target.checked),
          }),
          "Candidate star ratings enabled for this site"
        )
      ),
      error && h("p", { className: "text-sm text-oxide" }, error),
      h(
        "div",
        { className: "flex gap-2" },
        h(
          "button",
          { type: "submit", disabled: busy, className: "btn-primary" },
          busy ? "Saving…" : editingId ? "Save changes" : "Add site"
        ),
        editingId &&
          h(
            "button",
            { type: "button", onClick: resetForm, className: "btn-ghost" },
            "Cancel"
          )
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
            { className: "flex gap-3" },
            site.heroImageKey &&
              h("img", {
                src: "/api/files?key=" + encodeURIComponent(site.heroImageKey),
                alt: "",
                className: "h-16 w-16 shrink-0 rounded-md object-cover",
              }),
            h(
              "div",
              null,
              h("p", { className: "font-display text-lg uppercase tracking-wide" }, site.name),
              site.operatorCompany && h("p", { className: "text-xs text-ink/50" }, "Operated by " + site.operatorCompany.name),
              h(
                "p",
                { className: "text-xs text-ink/50" },
                [site.city, site.region, site.countryCode].filter(Boolean).join(", ")
              ),
              h(
                "p",
                { className: "mt-1 text-sm text-ink/70" },
                [site.commodity, site.accessType].filter(Boolean).join(" · ") || "No commodity/access set"
              ),
              site.rosterPatterns.length > 0 &&
                h("p", { className: "mt-1 text-xs text-ink/50" }, "Rosters: " + site.rosterPatterns.join(", ")),
              site.description &&
                h("p", { className: "mt-1 max-w-md text-xs text-ink/60" }, site.description.slice(0, 160) + (site.description.length > 160 ? "…" : "")),
              site.galleryKeys.length > 0 &&
                h("p", { className: "mt-1 text-xs text-ink/50" }, site.galleryKeys.length + " gallery photo" + (site.galleryKeys.length === 1 ? "" : "s"))
            )
          ),
          h(
            "div",
            { className: "flex flex-wrap items-center gap-2" },
            h("span", { className: "tag " + STATUS_TONE[site.status] }, site.status.toLowerCase().replace("_", " ")),
            h(
              "button",
              { onClick: () => startEdit(site), className: "text-sm underline" },
              "Edit"
            ),
            site.status === "PENDING_REVIEW"
              ? h(
                  "span",
                  { className: "flex items-center gap-2" },
                  h(
                    "button",
                    { onClick: () => setStatus(site, "PUBLISHED"), className: "btn-primary text-sm" },
                    "Approve & publish"
                  ),
                  h(
                    "button",
                    { onClick: () => setStatus(site, "DRAFT"), className: "text-sm text-oxide underline" },
                    "Reject"
                  )
                )
              : h(
                  "button",
                  { onClick: () => setStatus(site, site.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"), className: "btn-primary text-sm" },
                  site.status === "PUBLISHED" ? "Unpublish" : "Publish"
                ),
            h(
              "button",
              { onClick: () => toggleRatings(site), className: "text-sm underline" },
              site.ratingsEnabled ? "Turn ratings off" : "Turn ratings on"
            ),
            h(
              "button",
              { onClick: () => removeSite(site.id), className: "text-sm text-oxide underline" },
              "Remove"
            )
          )
        )
      )
    )
  );
}
