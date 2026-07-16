"use client";

import { useState } from "react";

type Result = {
  id: string;
  firstName: string;
  headline: string | null;
  countryCode: string | null;
  region: string | null;
  yearsExperience: number | null;
  fifoPreference: string | null;
  commodities: string[];
  siteExperience: string[];
  certifications: { name: string }[];
};

function pretty(v: string) {
  return v.replaceAll("_", " ").toLowerCase();
}

export function CandidateSearch() {
  const [filters, setFilters] = useState({ q: "", country: "", commodity: "", site: "", fifo: "" });
  const [results, setResults] = useState<Result[] | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outreach, setOutreach] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState("");
  const [sendState, setSendState] = useState<{ ok: boolean; text: string } | null>(null);

  async function search(p = 1) {
    setBusy(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.country) params.set("country", filters.country);
    if (filters.commodity) params.set("commodity", filters.commodity);
    if (filters.site) params.set("site", filters.site);
    if (filters.fifo) params.set("fifo", filters.fifo);
    params.set("page", String(p));
    const res = await fetch(`/api/candidates/search?${params}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      return;
    }
    setResults(data.results);
    setPage(p);
  }

  async function sendOutreach(e: React.FormEvent) {
    e.preventDefault();
    if (!outreach) return;
    setSendState(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: outreach.id, body: message }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSendState({ ok: true, text: `Message sent to ${outreach.name}` });
      setOutreach(null);
      setMessage("");
    } else {
      setSendState({ ok: false, text: data.error ?? "Could not send" });
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); search(1); }}
        className="card grid gap-3 sm:grid-cols-5"
      >
        <input className="field sm:col-span-2" placeholder="Keyword, ticket, cert…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <input className="field uppercase" placeholder="Country (AU)" maxLength={2} value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} />
        <select className="field" value={filters.commodity} onChange={(e) => setFilters({ ...filters, commodity: e.target.value })}>
          <option value="">Any commodity</option>
          {["GOLD","IRON_ORE","COAL","COPPER","LITHIUM","NICKEL","BAUXITE_ALUMINA","URANIUM","MINERAL_SANDS","RARE_EARTHS","ZINC_LEAD","OIL_GAS","OTHER"].map((v) => (
            <option key={v} value={v}>{pretty(v)}</option>
          ))}
        </select>
        <select className="field" value={filters.fifo} onChange={(e) => setFilters({ ...filters, fifo: e.target.value })}>
          <option value="">Any arrangement</option>
          <option value="FIFO">FIFO</option>
          <option value="DIDO">DIDO</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="FLEXIBLE">Flexible</option>
        </select>
        <button className="btn-primary sm:col-span-5" disabled={busy}>
          {busy ? "Searching…" : "Search candidates"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-oxide" role="alert">{error}</p>}
      {sendState && (
        <p className={`mt-3 text-sm ${sendState.ok ? "text-patina" : "text-oxide"}`} role="status">{sendState.text}</p>
      )}

      {results && (
        <>
          {results.length === 0 ? (
            <p className="card mt-4 text-sm text-ink/60">No candidates match those filters.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {results.map((r) => (
                <li key={r.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {r.firstName}
                        {r.yearsExperience != null && <span className="text-ink/50"> · {r.yearsExperience} yrs</span>}
                      </p>
                      {r.headline && <p className="text-sm text-ink/70">{r.headline}</p>}
                      <p className="mt-1 text-xs text-ink/50">
                        {[r.countryCode, r.region].filter(Boolean).join(" · ")}
                        {r.fifoPreference && ` · ${pretty(r.fifoPreference)}`}
                      </p>
                    </div>
                    <button className="btn-dark" onClick={() => { setOutreach({ id: r.id, name: r.firstName }); setSendState(null); }}>
                      Message
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.commodities.slice(0, 5).map((c) => <span key={c} className="tag">{pretty(c)}</span>)}
                    {r.certifications.map((c) => <span key={c.name} className="tag bg-patina/10">{c.name}</span>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            {page > 1 && <button className="btn-ghost" onClick={() => search(page - 1)}>← Previous</button>}
            {results.length === 20 && <button className="btn-ghost" onClick={() => search(page + 1)}>Next →</button>}
          </div>
        </>
      )}

      {outreach && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <form onSubmit={sendOutreach} className="card w-full max-w-md bg-white">
            <h3 className="font-display text-xl uppercase tracking-wide">Message {outreach.name}</h3>
            <p className="mt-1 text-xs text-ink/50">
              Outreach counts against your plan&rsquo;s daily cap. Keep it relevant — spam reports affect your account.
            </p>
            <textarea
              className="field mt-3 min-h-28"
              required
              maxLength={5000}
              placeholder="Hi — we're hiring for…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button type="submit" className="btn-primary">Send</button>
              <button type="button" className="btn-ghost" onClick={() => setOutreach(null)}>Cancel</button>
            </div>
            {sendState && !sendState.ok && <p className="mt-2 text-sm text-oxide">{sendState.text}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
