"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createElement as h, Fragment } from "react";

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
  status: "DRAFT" | "PUBLISHED";
  operatorCompany: { id: string; name: string; slug: string } | null;
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
  const [foodNotes, setFoodNotes] = useState("");
  const [otherAmenities, setOtherAmenities] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null as string | null);

async function addSite(e: any) {
  e.preventDefault();
  setBusy(true);
  setError(null);

  const res = await fetch("/api/admin/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
      foodNotes: foodNotes || undefined,
      otherAmenities: otherAmenities || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  setBusy(false);
  if (!res.ok) {
    setError(data.error ?? "Could not create site");
    return;
  }
  setSites((prev) => [data.site, ...prev]);
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
  setFoodNotes("");
  setOtherAmenities("");
  router.refresh();
}

async function toggleStatus(site: Site) {
  const nextStatus = site.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  const res = await fetch(`/api/admin/sites/${site.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: nextStatus }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) setSites((prev) => prev.map((s) => (s.id === site.id ? data.site : s)));
}

async function removeSite(siteId: string) {
  if (!confirm("Delete this site? Jobs linked to it will keep their own details but lose the site link.")) return;
  const res = await fetch(`/api/admin/sites/${siteId}`, { method: "DELETE" });
  if (res.ok) setSites((prev) => prev.filter((s) => s.id !== siteId));
}

return h(
  "div",
  { className: "space-y-6" },
  h(
    "form",
    { onSubmit: addSite, className: "card space-y-3" },
    h("p", { className: "text-sm text-ink/60" }, "Add a mining site's roster, access and camp details. Fields left blank can be filled in later."),
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
        )
      ),
    error && h("p", { className: "text-sm text-oxide" }, error),
    h(
      "button",
      { type: "submit", disabled: busy, className: "btn-primary" },
      busy ? "Adding…" : "Add site"
      )
    ),
  h(
    "ul",
    { className: "space-y-3" },
    sites.map((site) =>
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
            ),
          site.rosterPatterns.length > 0 &&
          h("p", { className: "mt-1 text-xs text-ink/50" }, "Rosters: " + site.rosterPatterns.join(", "))
          ),
        h(
          "div",
          { className: "flex items-center gap-2" },
          h("span", { className: "tag" }, site.status),
          h(
            "button",
            { onClick: () => toggleStatus(site), className: "btn-primary text-sm" },
            site.status === "PUBLISHED" ? "Unpublish" : "Publish"
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
