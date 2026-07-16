"use client";

import { useState } from "react";

const COMMODITIES = [
  "GOLD","IRON_ORE","COAL","COPPER","LITHIUM","NICKEL","BAUXITE_ALUMINA","URANIUM",
  "MINERAL_SANDS","RARE_EARTHS","ZINC_LEAD","OIL_GAS","OTHER",
];

export function BroadcastComposer() {
  const [audience, setAudience] = useState("CANDIDATES");
  const [tier, setTier] = useState("");
  const [commodity, setCommodity] = useState("");
  const [region, setRegion] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  function payload(preview: boolean) {
    return {
      audience,
      tier: audience === "EMPLOYERS" && tier ? tier : undefined,
      commodity: audience === "CANDIDATES" && commodity ? commodity : undefined,
      region: audience === "CANDIDATES" && region ? region : undefined,
      subject,
      body,
      preview,
    };
  }

  async function call(preview: boolean) {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(preview)),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Failed");
      return;
    }
    if (preview) {
      setPreviewCount(data.recipients);
      setStatus(`Audience: ${data.segment} — ${data.recipients} recipient(s)`);
    } else {
      setPreviewCount(null);
      setStatus(`Sent to ${data.sent} of ${data.recipients} recipient(s)${data.failed ? `, ${data.failed} failed` : ""}.`);
      setSubject("");
      setBody("");
    }
  }

  async function send() {
    if (previewCount === null) {
      setStatus("Preview the audience first, then send.");
      return;
    }
    if (!window.confirm(`Send this email to ${previewCount} recipient(s)?`)) return;
    await call(false);
  }

  return (
    <div className="card space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="bc-audience">Audience</label>
          <select id="bc-audience" className="field" value={audience} onChange={(e) => { setAudience(e.target.value); setPreviewCount(null); }}>
            <option value="CANDIDATES">All candidates</option>
            <option value="EMPLOYERS">All employers</option>
            <option value="ALL">Everyone</option>
          </select>
        </div>
        {audience === "EMPLOYERS" && (
          <div>
            <label className="label" htmlFor="bc-tier">Plan tier (optional)</label>
            <select id="bc-tier" className="field" value={tier} onChange={(e) => { setTier(e.target.value); setPreviewCount(null); }}>
              <option value="">Any tier</option>
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
            </select>
          </div>
        )}
        {audience === "CANDIDATES" && (
          <>
            <div>
              <label className="label" htmlFor="bc-commodity">Commodity (optional)</label>
              <select id="bc-commodity" className="field" value={commodity} onChange={(e) => { setCommodity(e.target.value); setPreviewCount(null); }}>
                <option value="">Any commodity</option>
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>{c.replaceAll("_", " ").toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="bc-region">Region (optional)</label>
              <input id="bc-region" className="field" placeholder="e.g. Western Australia" value={region} onChange={(e) => { setRegion(e.target.value); setPreviewCount(null); }} />
            </div>
          </>
        )}
      </div>
      <div>
        <label className="label" htmlFor="bc-subject">Subject</label>
        <input id="bc-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bc-body">Message (plain text)</label>
        <textarea id="bc-body" className="field min-h-40" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" disabled={busy || !subject || !body} onClick={() => call(true)}>
          Preview audience
        </button>
        <button className="btn-primary flex-1" disabled={busy || !subject || !body} onClick={send}>
          {busy ? "Working…" : "Send broadcast"}
        </button>
      </div>
      {status && <p className="text-sm text-ink/70">{status}</p>}
      <p className="text-xs text-ink/50">
        Recipients whose latest marketing-email consent is withdrawn are excluded automatically.
      </p>
    </div>
  );
}
