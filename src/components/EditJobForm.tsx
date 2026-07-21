"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const COMMODITIES = ["GOLD","IRON_ORE","COAL","COPPER","LITHIUM","NICKEL","BAUXITE_ALUMINA","URANIUM","MINERAL_SANDS","RARE_EARTHS","ZINC_LEAD","OIL_GAS","OTHER"];
const SITES = ["OPEN_PIT","UNDERGROUND","PROCESSING_PLANT","EXPLORATION","PORT_RAIL","SMELTER_REFINERY","WORKSHOP_MAINTENANCE","CORPORATE_OFFICE"];
const EMPLOYMENT = ["FULL_TIME","PART_TIME","CONTRACT","CASUAL","APPRENTICESHIP"];
const PERIODS = ["HOUR","DAY","YEAR"];

function pretty(v: string) {
  return v.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

type Fields = {
  title: string;
  description: string;
  countryCode: string;
  region: string;
  city: string;
  employmentType: string;
  commodity: string;
  siteType: string;
  roleCategory: string;
  fifo: boolean;
  rosterPattern: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
};

export function EditJobForm(props: {
  jobId: string;
  status: string;
  isRejected: boolean;
  canPublish: boolean;
  initial: Fields;
}) {
  const router = useRouter();
  const [f, setF] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; overage?: boolean } | null>(null);

  async function submit(submitForReview: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/jobs/${props.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title,
        description: f.description,
        countryCode: f.countryCode,
        region: f.region || null,
        city: f.city || null,
        employmentType: f.employmentType,
        commodity: f.commodity || null,
        siteType: f.siteType || null,
        roleCategory: f.roleCategory || null,
        fifo: f.fifo,
        rosterPattern: f.rosterPattern || null,
        salaryMin: f.salaryMin ? Number(f.salaryMin) : null,
        salaryMax: f.salaryMax ? Number(f.salaryMax) : null,
        salaryCurrency: f.salaryCurrency ? f.salaryCurrency.toUpperCase() : null,
        salaryPeriod: f.salaryPeriod || null,
        submit: submitForReview,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({
        ok: true,
        text:
          submitForReview && data.status === "PUBLISHED"
            ? "Published!"
            : submitForReview
              ? "Submitted for review"
              : "Changes saved",
      });
      router.refresh();
    } else if (res.status === 402 && data.action === "PURCHASE_OVERAGE") {
      setMsg({ ok: false, text: data.error, overage: true });
    } else {
      setMsg({ ok: false, text: data.error ?? "Could not save job" });
    }
  }

  const isDraft = props.status === "DRAFT";
  const submitLabel = props.isRejected ? "Resubmit for review" : "Publish now";
  const submitDisabled = busy || (isDraft && !props.isRejected && !props.canPublish);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="card space-y-4">
      <div>
        <label className="label" htmlFor="j-title">Job title</label>
        <input id="j-title" className="field" required minLength={4} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="j-desc">Description</label>
        <textarea id="j-desc" className="field min-h-36" required minLength={30} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="j-cc">Country (ISO)</label>
          <input id="j-cc" className="field uppercase" required maxLength={2} placeholder="AU" value={f.countryCode} onChange={(e) => setF({ ...f, countryCode: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="j-region">State / region</label>
          <input id="j-region" className="field" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="j-city">City / site town</label>
          <input id="j-city" className="field" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="j-emp">Employment type</label>
          <select id="j-emp" className="field" value={f.employmentType} onChange={(e) => setF({ ...f, employmentType: e.target.value })}>
            {EMPLOYMENT.map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="j-com">Commodity</label>
          <select id="j-com" className="field" value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })}>
            <option value="">—</option>
            {COMMODITIES.map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="j-site">Site type</label>
          <select id="j-site" className="field" value={f.siteType} onChange={(e) => setF({ ...f, siteType: e.target.value })}>
            <option value="">—</option>
            {SITES.map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="j-role">Role category</label>
          <input id="j-role" className="field" placeholder="e.g. Drill & Blast" value={f.roleCategory} onChange={(e) => setF({ ...f, roleCategory: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" checked={f.fifo} onChange={(e) => setF({ ...f, fifo: e.target.checked })} />
          <span className="text-sm">FIFO role</span>
        </label>
        <div>
          <label className="label" htmlFor="j-roster">Roster (e.g. 2/1, 8/6)</label>
          <input id="j-roster" className="field" maxLength={20} value={f.rosterPattern} onChange={(e) => setF({ ...f, rosterPattern: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="j-smin">Salary min</label>
          <input id="j-smin" type="number" min={1} className="field" value={f.salaryMin} onChange={(e) => setF({ ...f, salaryMin: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="j-smax">Salary max</label>
          <input id="j-smax" type="number" min={1} className="field" value={f.salaryMax} onChange={(e) => setF({ ...f, salaryMax: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="j-cur">Currency</label>
          <input id="j-cur" className="field uppercase" maxLength={3} placeholder="AUD" value={f.salaryCurrency} onChange={(e) => setF({ ...f, salaryCurrency: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="j-per">Per</label>
          <select id="j-per" className="field" value={f.salaryPeriod} onChange={(e) => setF({ ...f, salaryPeriod: e.target.value })}>
            <option value="">—</option>
            {PERIODS.map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
          </select>
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-patina" : "text-oxide"}`} role="status">
          {msg.text}{" "}
          {msg.overage && (
            <Link href="/dashboard/employer/billing" className="underline">Buy a single post or upgrade →</Link>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => submit(false)}>
          Save changes
        </button>
        {isDraft && (
          <button type="button" className="btn-primary" disabled={submitDisabled} onClick={() => submit(true)}>
            {busy ? "Working…" : !props.isRejected && !props.canPublish ? "Quota exhausted" : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
