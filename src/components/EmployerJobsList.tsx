"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";

export type EmployerJob = {
  id: string;
  slug: string;
  title: string;
  countryCode: string;
  region: string | null;
  createdAt: string;
  source: string;
  isPriority: boolean;
  status: string;
  reviewNotes: string | null;
  applicationCount: number;
};

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "bg-patina/15 text-patina",
  DRAFT: "bg-oregold/20",
  PENDING_REVIEW: "bg-oregold/30",
  ARCHIVED: "bg-ink/10 text-ink/40",
  EXPIRED: "bg-ink/5 text-ink/40",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "in review",
};

/** Employer's own "All ads" list: bulk select + delete, per-row edit/delete,
 * alongside the existing rejected-draft callout. Delete is a soft archive
 * for anything with history worth keeping (published, has applicants) and
 * a real removal only for a draft that was never seen publicly and has no
 * applicants — see src/app/api/jobs/[id]/route.ts for the exact rule. */
export function EmployerJobsList({ jobs }: { jobs: EmployerJob[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideArchived, setHideArchived] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deleted: number; archived: number } | null>(null);

  const archivedCount = jobs.filter((j) => j.status === "ARCHIVED").length;
  const visible = hideArchived ? jobs.filter((j) => j.status !== "ARCHIVED") : jobs;
  const allSelected = visible.length > 0 && visible.every((j) => selected.has(j.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((j) => j.id)));
  }

  async function deleteOne(job: EmployerJob) {
    const willArchive = !(job.status === "DRAFT" && job.applicationCount === 0);
    if (
      !window.confirm(
        willArchive
          ? `Take "${job.title}" down? It'll be archived — removed from the public site, but its history is kept.`
          : `Delete "${job.title}"? This draft was never published and has no applicants, so it'll be removed for good.`
      )
    ) {
      return;
    }
    setBusyId(job.id);
    setError(null);
    const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else {
      setError(data.error ?? "Could not remove job");
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const count = selected.size;
    if (
      !window.confirm(
        `Remove ${count} job ad${count === 1 ? "" : "s"}? Drafts with no applicants are deleted outright; anything else is archived and taken off the public site.`
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/jobs/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobIds: Array.from(selected) }),
    });
    const data = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (res.ok) {
      setSelected(new Set());
      setResult({ deleted: data.deleted ?? 0, archived: data.archived ?? 0 });
      router.refresh();
    } else {
      setError(data.error ?? "Bulk remove failed");
    }
  }

  if (jobs.length === 0) {
    return <p className="card mt-3 text-sm text-ink/60">Nothing posted yet.</p>;
  }

  return (
    <div>
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-sand/40">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allSelected} disabled={visible.length === 0} onChange={toggleAll} />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-ink/60">
              <input type="checkbox" checked={hideArchived} onChange={(e) => setHideArchived(e.target.checked)} />
              Hide archived ({archivedCount})
            </label>
          )}
          <button className="btn-primary text-sm" disabled={selected.size === 0 || bulkBusy} onClick={bulkDelete}>
            {bulkBusy ? "Removing…" : selected.size > 0 ? `Delete ${selected.size} selected` : "Delete selected"}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
      {result && (
        <p className="mt-1 text-xs text-ink/60">
          {result.deleted > 0 && `${result.deleted} deleted`}
          {result.deleted > 0 && result.archived > 0 && " · "}
          {result.archived > 0 && `${result.archived} archived`}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {visible.map((j) => (
          <li key={j.id} className="card flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={selected.has(j.id)}
              onChange={() => toggle(j.id)}
              aria-label={`Select ${j.title}`}
            />
            <div className="min-w-0 flex-1">
              <Link href={`/jobs/${j.slug}`} className="block truncate font-semibold hover:underline">
                {j.title}
              </Link>
              <p className="text-xs text-ink/60">
                {j.countryCode}
                {j.region ? ` · ${j.region}` : ""} ·{" "}
                <Link href={`/dashboard/employer/jobs/${j.id}/applicants`} className="underline">
                  {j.applicationCount} appl.
                </Link>
                {" · "}
                {timeAgo(new Date(j.createdAt))}
                {j.source !== "MANUAL" && ` · ${j.source.toLowerCase()} import`}
                {j.isPriority && " · priority"}
              </p>
              {j.status === "DRAFT" && j.reviewNotes && (
                <p className="mt-1 text-xs text-oxide">
                  Rejected by moderation: {j.reviewNotes} —{" "}
                  <Link href={`/dashboard/employer/jobs/${j.id}/edit`} className="underline">
                    fix and resubmit
                  </Link>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={`tag ${STATUS_TONE[j.status] ?? ""}`}>
                {STATUS_LABEL[j.status] ?? j.status.toLowerCase()}
              </span>
              <div className="flex gap-1">
                <Link href={`/dashboard/employer/jobs/${j.id}/edit`} className="btn-ghost !px-2 !py-1 text-xs">
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-xs text-oxide"
                  disabled={busyId === j.id}
                  onClick={() => deleteOne(j)}
                >
                  {busyId === j.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
