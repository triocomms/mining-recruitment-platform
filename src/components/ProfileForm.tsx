"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/RichTextEditor";

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
// verificationStatus is server-controlled and read-only here — it's only
// ever set by /api/profile based on whether the document changed, or by an
// admin approving/rejecting it.
type Cert = {
  name: string;
  issuer: string;
  referenceNo: string;
  expiresAt: string;
  documentKey: string | null;
  verificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

// startDate/endDate: "YYYY-MM-DD" or "" (blank endDate = current role).
type EmploymentEntry = {
  companyName: string;
  title: string;
  siteType: string;
  commodity: string;
  startDate: string;
  endDate: string;
  documentKey: string | null;
  verificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

function VerificationBadge({ status }: { status?: string }) {
  if (!status || status === "UNVERIFIED") return null;
  if (status === "VERIFIED") return <span className="tag !bg-patina/15 !text-patina">✓ Verified</span>;
  if (status === "PENDING") return <span className="tag !bg-hivis/15 !text-hivis-deep">Verification pending</span>;
  if (status === "REJECTED") return <span className="tag !bg-oxide/10 !text-oxide">Verification declined</span>;
  return null;
}

export function ProfileForm(props: {
  hasResume?: boolean;
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
    employmentHistory: EmploymentEntry[];
  };
}) {
  const router = useRouter();
  const [f, setF] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadingCert, setUploadingCert] = useState<number | null>(null);
  const [uploadingEmployment, setUploadingEmployment] = useState<number | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [parseMsg, setParseMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Heuristic suggestions only ever fill gaps — an existing value (typed by
  // the candidate, or from an earlier save) is never overwritten, and
  // nothing here is persisted until "Save profile" is clicked.
  async function parseResume() {
    setParsingResume(true);
    setParseMsg(null);
    try {
      const res = await fetch("/api/candidate/resume-parse", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParseMsg({ ok: false, text: data.error ?? "Could not parse your resume" });
        return;
      }
      const s = data.suggested ?? {};
      const dedupUpper = (existing: string[], extra: string[] = []) =>
        Array.from(new Set([...existing, ...extra]));
      const existingCertNames = new Set(f.certifications.map((c) => c.name.toLowerCase()));
      const newCerts: Cert[] = (s.certifications ?? [])
        .filter((name: string) => !existingCertNames.has(name.toLowerCase()))
        .map((name: string) => ({ name, issuer: "", referenceNo: "", expiresAt: "", documentKey: null }));

      setF((prev) => ({
        ...prev,
        phone: prev.phone || s.phone || prev.phone,
        yearsExperience: prev.yearsExperience ?? s.yearsExperience ?? prev.yearsExperience,
        fifoPreference: prev.fifoPreference || s.fifoPreference || prev.fifoPreference,
        siteExperience: dedupUpper(prev.siteExperience, s.siteExperience),
        commodities: dedupUpper(prev.commodities, s.commodities),
        certifications: [...prev.certifications, ...newCerts],
      }));

      const found =
        (s.phone ? 1 : 0) +
        (s.yearsExperience !== undefined ? 1 : 0) +
        (s.fifoPreference ? 1 : 0) +
        (s.siteExperience?.length ?? 0) +
        (s.commodities?.length ?? 0) +
        newCerts.length;
      setParseMsg(
        found > 0
          ? { ok: true, text: `Filled in ${found} field${found === 1 ? "" : "s"} below from your resume — review before saving.` }
          : { ok: true, text: "Couldn't confidently pick anything out of your resume — nothing changed." }
      );
    } catch {
      setParseMsg({ ok: false, text: "Something went wrong reading your resume" });
    } finally {
      setParsingResume(false);
    }
  }

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

  async function uploadEmploymentDoc(i: number, file: File) {
    setUploadingEmployment(i);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "employment", contentType: file.type }),
      });
      const { key, url, maxBytes, error } = await presign.json();
      if (!presign.ok) throw new Error(error);
      if (file.size > maxBytes) throw new Error(`File must be under ${Math.round(maxBytes / 1024 / 1024)} MB`);
      const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Upload failed — try again");
      const next = [...f.employmentHistory];
      next[i] = { ...next[i], documentKey: key };
      setF((prev) => ({ ...prev, employmentHistory: next }));
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Upload failed" });
    } finally {
      setUploadingEmployment(null);
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
        employmentHistory: f.employmentHistory
          .filter((e) => e.companyName.trim() && e.title.trim() && e.startDate)
          .map((e) => ({
            companyName: e.companyName.trim(),
            title: e.title.trim(),
            siteType: e.siteType || null,
            commodity: e.commodity || null,
            startDate: new Date(`${e.startDate}T00:00:00.000Z`).toISOString(),
            endDate: e.endDate ? new Date(`${e.endDate}T00:00:00.000Z`).toISOString() : null,
            documentKey: e.documentKey || null,
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
      {props.hasResume && (
        <div className="card flex flex-wrap items-center gap-3 border-ink/10 text-sm">
          <button type="button" className="btn-ghost" onClick={parseResume} disabled={parsingResume}>
            {parsingResume ? "Reading your resume…" : "Suggest fields from my resume"}
          </button>
          <p className="text-xs text-ink/50">
            Best-effort keyword matching — it only fills in blanks below, never overwrites what you've
            already entered. Always double-check before saving.
          </p>
          {parseMsg && (
            <p className={`w-full text-xs ${parseMsg.ok ? "text-patina" : "text-oxide"}`} role="status">
              {parseMsg.text}
            </p>
          )}
        </div>
      )}

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
        <RichTextEditor id="summary" className="min-h-32" maxLength={4000} value={f.summary} onChange={(v) => setF({ ...f, summary: v })} />
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
              {c.verificationStatus && c.verificationStatus !== "UNVERIFIED" && (
                <div className="mb-2"><VerificationBadge status={c.verificationStatus} /></div>
              )}
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

      <fieldset>
        <legend className="label">Work history</legend>
        <p className="mb-2 text-xs text-ink/50">
          Optional, but a verified role carries more weight with employers than the tags above alone.
        </p>
        {f.employmentHistory.map((entry, i) => (
          <div key={i} className="mb-3 rounded-md border border-ink/10 p-2">
            {entry.verificationStatus && entry.verificationStatus !== "UNVERIFIED" && (
              <div className="mb-2"><VerificationBadge status={entry.verificationStatus} /></div>
            )}
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <input
                className="field flex-1 basis-full sm:basis-auto"
                placeholder="Company name"
                value={entry.companyName}
                onChange={(e) => {
                  const next = [...f.employmentHistory];
                  next[i] = { ...next[i], companyName: e.target.value };
                  setF({ ...f, employmentHistory: next });
                }}
              />
              <input
                className="field flex-1 basis-full sm:basis-auto"
                placeholder="Job title"
                value={entry.title}
                onChange={(e) => {
                  const next = [...f.employmentHistory];
                  next[i] = { ...next[i], title: e.target.value };
                  setF({ ...f, employmentHistory: next });
                }}
              />
              <button
                type="button"
                className="btn-ghost px-3"
                aria-label="Remove role"
                onClick={() => setF({ ...f, employmentHistory: f.employmentHistory.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 sm:flex-nowrap">
              <select
                className="field flex-1 basis-full sm:basis-auto"
                aria-label="Site type (optional)"
                value={entry.siteType}
                onChange={(e) => {
                  const next = [...f.employmentHistory];
                  next[i] = { ...next[i], siteType: e.target.value };
                  setF({ ...f, employmentHistory: next });
                }}
              >
                <option value="">Site type (optional)</option>
                {SITE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className="field flex-1 basis-full sm:basis-auto"
                aria-label="Commodity (optional)"
                value={entry.commodity}
                onChange={(e) => {
                  const next = [...f.employmentHistory];
                  next[i] = { ...next[i], commodity: e.target.value };
                  setF({ ...f, employmentHistory: next });
                }}
              >
                <option value="">Commodity (optional)</option>
                {COMMODITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <input
                type="date"
                className="field flex-1 basis-full sm:basis-auto sm:w-40"
                aria-label="Start date"
                title="Start date"
                value={entry.startDate}
                onChange={(e) => {
                  const next = [...f.employmentHistory];
                  next[i] = { ...next[i], startDate: e.target.value };
                  setF({ ...f, employmentHistory: next });
                }}
              />
              <input
                type="date"
                className="field flex-1 basis-full sm:basis-auto sm:w-40"
                aria-label="End date (leave blank if current)"
                title="End date — leave blank if this is your current role"
                value={entry.endDate}
                onChange={(e) => {
                  const next = [...f.employmentHistory];
                  next[i] = { ...next[i], endDate: e.target.value };
                  setF({ ...f, employmentHistory: next });
                }}
              />
              <span className="shrink-0 text-xs text-ink/50">Leave end date blank if current</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <label className="btn-ghost shrink-0 cursor-pointer text-sm">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="sr-only"
                  disabled={uploadingEmployment === i}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadEmploymentDoc(i, file);
                  }}
                />
                {uploadingEmployment === i ? "Uploading…" : entry.documentKey ? "Replace proof" : "Attach proof (payslip, reference)"}
              </label>
              {entry.documentKey && (
                <a
                  href={`/api/files?key=${encodeURIComponent(entry.documentKey)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-patina underline"
                >
                  View
                </a>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            setF({
              ...f,
              employmentHistory: [
                ...f.employmentHistory,
                { companyName: "", title: "", siteType: "", commodity: "", startDate: "", endDate: "", documentKey: null },
              ],
            })
          }
        >
          + Add role
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
