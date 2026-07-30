"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type AdminJobRow = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  location: string;
  publishedAgo: string | null;
  salary: string | null;
};

/**
 * Admin-only "Live jobs" list with a per-row Remove action, for corrupted
 * or garbage listings (bad RSS parses, spam, etc.) that need to come off the
 * site immediately. Calls the admin DELETE route (src/app/api/admin/jobs/
 * [id]/route.ts), which archives anything with history and hard-deletes
 * only a DRAFT with zero applications -- so "Remove" here always means the
 * job disappears from the public site right away, even though the row may
 * be kept (archived) rather than physically deleted.
 */
export function AdminJobsList({ jobs }: { jobs: AdminJobRow[] }) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function removeJob(job: AdminJobRow) {
    if (
      !confirm(
        `Remove "${job.title}" (${job.companyName})? This hides it from the site immediately.`
      )
    ) {
      return;
    }
    setBusyId(job.id);
    setError(null);
    const res = await fetch(`/api/admin/jobs/${job.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Could not remove job");
      return;
    }
    setRemovedIds((prev) => new Set(prev).add(job.id));
    router.refresh();
  }

  const visible = jobs.filter((j) => !removedIds.has(j.id));

  return (
    <div>
      {error && (
        <p className="mt-2 text-sm text-oxide" role="alert">
          {error}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {visible.map((j) => (
          <li key={j.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link href={`/jobs/${j.slug}`} className="block truncate font-semibold hover:underline">
                {j.title}
              </Link>
              <p className="text-xs text-ink/60">
                {j.companyName} · {j.location}
                {j.publishedAgo && <> · published {j.publishedAgo}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tag">{j.salary ?? "No salary listed"}</span>
              <button
                onClick={() => removeJob(j)}
                disabled={busyId === j.id}
                className="text-sm text-oxide underline"
              >
                {busyId === j.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && <p className="card text-sm text-ink/60">No jobs match.</p>}
      </ul>
    </div>
  );
}
