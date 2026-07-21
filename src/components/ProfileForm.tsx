"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SITE_OPTIONS = [
  ["OPEN_PIT", "Open pit"],
  ["UNDERGROUND", "Underground"],
  ["PROCESSING_PLANT", "Processing plant"],
  ["EXPLORATION", "Exploration"],
  ["PORT_RAIL", "Port & rail"],
  ["SMELTER_REFINERY", "Smelter / refinery"],
  ["WORKSHOP_MAINTENANCE", "Workshop / maintenance"],
  ["CORPORATE_OFFICE", "Corporate office"],
] as const;

const COMMODITY_OPTIONS = [
  ["GOLD", "Gold"],
  ["IRON_ORE", "Iron ore"],
  ["COAL", "Coal"],
  ["COPPER", "Copper"],
  ["LITHIUM", "Lithium"],
  ["NICKEL", "Nickel"],
  ["BAUXITE_ALUMINA", "Bauxite / alumina"],
  ["URANIUM", "Uranium"],
  ["MINERAL_SANDS", "Mineral sands"],
  ["RARE_EARTHS", "Rare earths"],
  ["ZINC_LEAD", "Zinc / lead"],
  ["OIL_GAS", "Oil & gas"],
  ["OTHER", "Other"],
] as const;

// expiresAt/availableFrom: "YYYY-MM-DD" or ""; documentKey: S3 key once an
// upload completes, or null/empty if no scan has been attached.
type Cert = { name: string; issuer: string; referenceNo: string; expiresAt: string; documentKey: string | null };

export function ProfileForm(props: {
  initial: {
    firstName: string;
    lastName: string;
    headline: string;
    summary: string;
    phone: string;
    countryCode: string;
    region: string;
    city: string;
    yearsExperience: number | null;
    fifoPreference: string;
    willingToRelocate: boolean;
    availableFrom: string;
    siteExperience: string[];
    commodities: string[];
    visibility: string;
    certifications: Cert[];
  };
}) {
  const router = useRouter();
  const [f, setF] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadingCert, setUploadingCert] = useState<number | null>(null);

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  // Certification docs are attached per-row before the form is saved — the
  // upload itself goes straight to S3 via presign (never touches the app
  // server), and the returned key just sits in local state until "Save
  // profile" persists the whole certifications array in one go.
  async function uploadCertDoc(i: number, file: File) {
    setUploadingCert(i);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "certification", contentType: file.type }),
      });
      const { key, url, maxBytes, error } = await presign.json();
      if (!presign.ok) throw new Error(error);
      if (file.size > maxBytes) throw new Error(`File must be under ${Math.round(maxBytes / 1024 / 1024)} MB`);
      const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Upload failed — try again");
      const next = [...f.certifications];
      next[i] = { ...next[i], documentKey: key };
      setF((prev) => ({ ...prev, certifications: next }));
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Upload failed" });
    } finally {
      setUploadingCert(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: f.firstName,
        lastName: f.lastName,
        headline: f.headline || null,
        summary: f.summary || null,
        phone: f.phone || null,
        countryCode: f.countryCode ? f.countryCode.toUpperCase() : null,
        region: f.region || null,
        city: f.city || null,
        yearsExperience: f.yearsExperience,
        fifoPreference: f.fifoPreference || null,
        willingToRelocate: f.willingToRelocate,
        availableFrom: f.availableFrom ? new Date(`${f.availableFrom}T00:00:00.000Z`).toISOString() : null,
        siteExperience: f.siteExperience,
        commodities: f.commodities,
        visibility: f.visibility,
        certifications: f.certifications
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            issuer: c.issuer.trim() || undefined,
            referenceNo: c.referenceNo.trim() || undefined,
            // The date input gives "YYYY-MM-DD"; the API expects a full ISO
            // datetime string (z.string().datetime()).
            expiresAt: c.expiresAt ? new Date(`${c.expiresAt}T00:00:00.000Z`).toISOString() : undefined,
            documentKey: c.documentKey || null,
          })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Profile saved" });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.error ?? "Could not save" });
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Visibility — the single most consequential switch on the page */}
      <fieldset className="card border-2 border-ink/10">
        <legend className="label px-1">Who can see your profile?</legend>
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="visibility"
            checked={f.visibility === "PRIVATE"}
            onChange={() => setF({ ...f, visibility: "PRIVATE" })}
            className="mt-1"
          />
          <span>
            <span className="font-semibold">Private</span>
            <span className="block text-sm text-ink/60">
              Only companies you apply to can see your details. Recommended default.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3">
          <input
            type="radio"
            name="visibility"
            checked={f.visibility === "PUBLIC"}
            onChange={() => setF({ ...f, visibility: "PUBLIC" })}
            className="mt-1"
          />
          <span>
            <span className="font-semibold">Open to verified employers</span>
            <span className="block text-sm text-ink/60">
              Verified, signed-in employers can find and contact you. Your profile is never shown to
              anonymous visitors or indexed by search engines. Switching this records your consent;
              you can change it back any time.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="firstName">First name</label>
          <input id="firstName" className="field" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="lastName">Last name</label>
          <input id="lastName" className="field" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="headline">Headline</label>
        <input id="headline" className="field" placeholder="e.g. HD Fitter — 8 yrs open pit, Pilbara" maxLength={120} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} />
      </div>

      <div>
        <label className="label" htmlFor="summary">Summary</label>
        <textarea id="summary" className="field min-h-32" maxLength={4000} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="years">Years of experience</label>
          <input
            id="years"
            type="number"
            min={0}
            max={60}
            className="field"
            value={f.yearsExperience ?? ""}
            onChange={(e) => setF({ ...f, yearsExperience: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="cc">Country (ISO code)</label>
          <input id="cc" className="field uppercase" maxLength={2} placeholder="AU" value={f.countryCode} onChange={(e) => setF({ ...f, countryCode: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="region">State / region</label>
          <input id="region" className="field" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="city">City / town</label>
          <input id="city" className="field" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fifo">Work arrangement</label>
          <select id="fifo" className="field" value={f.fifoPreference} onChange={(e) => setF({ ...f, fifoPreference: e.target.value })}>
            <option value="">No preference stated</option>
            <option value="FIFO">FIFO (fly in, fly out)</option>
            <option value="DIDO">DIDO (drive in, drive out)</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="FLEXIBLE">Flexible</option>
          </select>
        </div>
        <label className="flex items-center gap-3 self-end pb-2">
          <input type="checkbox" checked={f.willingToRelocate} onChange={(e) => setF({ ...f, willingToRelocate: e.target.checked })} />
          <span className="text-sm">Willing to relocate (incl. internationally)</span>
        </label>
      </div>

      <div>
        <label className="label" htmlFor="availableFrom">Available from</label>
        <input
          id="availableFrom"
          type="date"
          className="field sm:w-56"
          value={f.availableFrom}
          onChange={(e) => setF({ ...f, availableFrom: e.target.value })}
        />
        <p className="mt-1 text-xs text-ink/50">Leave blank if you're available immediately.</p>
      </div>

      <fieldset>
        <legend className="label">Site experience</legend>
        <div className="flex flex-wrap gap-2">
          {SITE_OPTIONS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => setF({ ...f, siteExperience: toggle(f.siteExperience, value) })}
              className={`tag ${f.siteExperience.includes(value) ? "bg-ink text-bone" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Commodities</legend>
        <div className="flex flex-wrap gap-2">
          {COMMODITY_OPTIONS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => setF({ ...f, commodities: toggle(f.commodities, value) })}
              className={`tag ${f.commodities.includes(value) ? "bg-ink text-bone" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Certifications & tickets</legend>
        <p className="mb-2 text-xs text-ink/50">e.g. HR licence, Working at Heights, First Aid, Standard 11</p>
        {f.certifications.map((c, i) => {
          const expired = c.expiresAt && c.expiresAt < new Date().toISOString().slice(0, 10);
          return (
            <div key={i} className="mb-3 rounded-md border border-ink/10 p-2">
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  className="field flex-1 basis-full sm:basis-auto"
                  placeholder="Ticket / cert name"
                  value={c.name}
                  onChange={(e) => {
                    const next = [...f.certifications];
                    next[i] = { ...next[i], name: e.target.value };
                    setF({ ...f, certifications: next });
                  }}
                />
                <input
                  className="field flex-1 basis-full sm:basis-auto"
                  placeholder="Issuer (optional)"
                  value={c.issuer}
                  onChange={(e) => {
                    const next = [...f.certifications];
                    next[i] = { ...next[i], issuer: e.target.value };
                    setF({ ...f, certifications: next });
                  }}
                />
                <div className="flex flex-1 basis-full items-center gap-1 sm:basis-auto sm:flex-none">
                  <input
                    type="date"
                    className={`field w-full sm:w-40 ${expired ? "border-oxide text-oxide" : ""}`}
                    aria-label="Expiry date (optional)"
                    title="Expiry date (optional) — leave blank if it doesn't expire"
                    value={c.expiresAt}
                    onChange={(e) => {
                      const next = [...f.certifications];
                      next[i] = { ...next[i], expiresAt: e.target.value };
                      setF({ ...f, certifications: next });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-ghost px-3"
                  aria-label="Remove certification"
                  onClick={() => setF({ ...f, certifications: f.certifications.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  className="field flex-1 basis-full sm:basis-auto"
                  placeholder="Reference / licence number (optional)"
                  value={c.referenceNo}
                  onChange={(e) => {
                    const next = [...f.certifications];
                    next[i] = { ...next[i], referenceNo: e.target.value };
                    setF({ ...f, certifications: next });
                  }}
                />
                <label className="btn-ghost shrink-0 cursor-pointer text-sm">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="sr-only"
                    disabled={uploadingCert === i}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) uploadCertDoc(i, file);
                    }}
                  />
                  {uploadingCert === i ? "Uploading…" : c.documentKey ? "Replace scan" : "Attach scan"}
                </label>
                {c.documentKey && (
                  <a
                    href={`/api/files?key=${encodeURIComponent(c.documentKey)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-patina underline"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            setF({
              ...f,
              certifications: [...f.certifications, { name: "", issuer: "", referenceNo: "", expiresAt: "", documentKey: null }],
            })
          }
        >
          + Add ticket
        </button>
      </fieldset>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-patina" : "text-oxide"}`} role="status">
          {msg.text}
        </p>
      )}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
