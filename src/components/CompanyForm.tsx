"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload";

export function CompanyForm(props: {
  initial: { name: string; website: string; description: string; countryCode: string; size: string };
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

  return (
    <form onSubmit={save} className="card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="co-name">Company name</label>
          <input id="co-name" className="field" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="co-web">Website</label>
          <input id="co-web" type="url" className="field" placeholder="https://" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="co-desc">About the company</label>
        <textarea id="co-desc" className="field min-h-28" maxLength={5000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="co-cc">HQ country (ISO code)</label>
          <input id="co-cc" className="field uppercase" maxLength={2} placeholder="AU" value={f.countryCode} onChange={(e) => setF({ ...f, countryCode: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="co-size">Company size</label>
          <select id="co-size" className="field" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })}>
            <option value="">Prefer not to say</option>
            <option>1–10</option>
            <option>11–50</option>
            <option>51–200</option>
            <option>201–1000</option>
            <option>1000+</option>
          </select>
        </div>
        <FileUpload kind="logo" label="Company logo" accept="image/*" field="logoKey" endpoint="/api/company" />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-patina" : "text-oxide"}`} role="status">{msg.text}</p>}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
