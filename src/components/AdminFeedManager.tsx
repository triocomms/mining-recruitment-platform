"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SyncSummary = {
  fetched: number;
  skippedUnparseable: number;
  created: number;
  published: number;
  draftedOverQuota: number;
  pendingReview: number;
  skippedDuplicates: number;
  skippedTierCap: number;
  expiredNoLongerInFeed: number;
};

type Feed = {
  id: string;
  url: string;
  label: string | null;
  status: "ACTIVE" | "PAUSED" | "ERROR";
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastSummary: SyncSummary | null;
  company: { id: string; name: string; slug: string; verificationStatus: string };
};

function SummaryLine({ s }: { s: SyncSummary }) {
  return (
    <p className="text-sm text-ink/70">
      {s.fetched} in feed · {s.published} published · {s.pendingReview} pending review ·{" "}
      {s.draftedOverQuota} drafted (over quota) · {s.skippedDuplicates} already imported ·{" "}
      {s.expiredNoLongerInFeed} expired (removed from feed)
      {s.skippedTierCap > 0 && <> · {s.skippedTierCap} not imported (plan limit reached)</>}
      {s.skippedUnparseable > 0 && <> · {s.skippedUnparseable} skipped (unreadable)</>}
    </p>
  );
}

export function AdminFeedManager({ initialFeeds }: { initialFeeds: Feed[] }) {
  const router = useRouter();
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedLabel, setFeedLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedSummary, setLastAddedSummary] = useState<SyncSummary | null>(null);

  async function addFeed(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastAddedSummary(null);

    const res = await fetch("/api/admin/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        website: website || undefined,
        feedUrl,
        feedLabel: feedLabel || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add feed");
      return;
    }
    setFeeds((prev) => [data.feed, ...prev]);
    setLastAddedSummary(data.syncResult?.summary ?? null);
    setCompanyName("");
    setWebsite("");
    setFeedUrl("");
    setFeedLabel("");
    router.refresh();
  }

  async function syncNow(feedId: string) {
    setSyncingId(feedId);
    const res = await fetch(\`/api/admin/feeds/\${feedId}/sync\`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSyncingId(null);
    if (res.ok) {
      setFeeds((prev) => prev.map((f) => (f.id === feedId ? data.feed : f)));
      router.refresh();
    }
  }

  async function toggleStatus(feed: Feed) {
    const nextStatus = feed.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    const res = await fetch(\`/api/admin/feeds/\${feed.id}\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setFeeds((prev) => prev.map((f) => (f.id === feed.id ? data.feed : f)));
  }

  async function removeFeed(feedId: string) {
    if (!confirm("Remove this feed? Jobs already imported from it will stay on FiFoDiDo.")) return;
    const res = await fetch(\`/api/admin/feeds/\${feedId}\`, { method: "DELETE" });
    if (res.ok) setFeeds((prev) => prev.filter((f) => f.id !== feedId));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addFeed} className="card space-y-3">
        <p className="text-sm text-ink/60">
          Point this at a company&apos;s public careers RSS/XML feed and we&apos;ll create a syndicated
          company profile for them, then keep their listings in sync automatically. Since we don&apos;t
          have a real employer signed in for these, a lightweight placeholder account is created behind
          the scenes to hold the company + jobs — nothing is emailed and nobody logs in with it. The first
          sync&apos;s jobs land in the usual admin review queue below on the main dashboard before going
          live; once a company has one published job, clean future imports auto-publish.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            placeholder="Company name (e.g. BHP)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="field"
          />
          <input
            type="url"
            placeholder="Website (optional)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="field"
          />
          <input
            type="url"
            required
            placeholder="https://careers.example.com/rss.xml"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            className="field sm:col-span-2"
          />
          <input
            type="text"
            placeholder="Label (optional, e.g. Careers — Australia)"
            value={feedLabel}
            onChange={(e) => setFeedLabel(e.target.value)}
            className="field sm:col-span-2"
          />
        </div>
        <button type="submit" className="btn-dark" disabled={busy}>
          {busy ? "Adding…" : "Add company + feed"}
        </button>
        {error && <p className="text-sm text-oxide" role="alert">{error}</p>}
        {lastAddedSummary && (
          <div className="rounded-md bg-bone p-3">
            <p className="mb-1 text-sm font-semibold">First sync complete</p>
            <SummaryLine s={lastAddedSummary} />
          </div>
        )}
      </form>

      {feeds.length === 0 ? (
        <p className="text-sm text-ink/60">No feeds set up yet.</p>
      ) : (
        <ul className="space-y-3">
          {feeds.map((feed) => (
            <li key={feed.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link href={\`/companies/\${feed.company.slug}\`} className="hover:underline">
                      {feed.company.name}
                    </Link>
                    {feed.company.verificationStatus === "VERIFIED" && (
                      <span className="ml-1.5 text-patina" title="Verified employer">✓</span>
                    )}
                  </p>
                  <p className="text-xs text-ink/50">{feed.label ? \`\${feed.label} — \` : ""}{feed.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={\`tag \${feed.status === "ERROR" ? "text-oxide" : ""}\`}>{feed.status}</span>
                  <button
                    onClick={() => syncNow(feed.id)}
                    disabled={syncingId === feed.id}
                    className="btn-primary text-sm"
                  >
                    {syncingId === feed.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button onClick={() => toggleStatus(feed)} className="btn-primary text-sm">
                    {feed.status === "PAUSED" ? "Resume" : "Pause"}
                  </button>
                  <button onClick={() => removeFeed(feed.id)} className="text-sm text-oxide underline">
                    Remove
                  </button>
                </div>
              </div>

              {feed.lastError && (
                <p className="text-sm text-oxide" role="alert">Last sync failed: {feed.lastError}</p>
              )}
              {feed.lastSummary && <SummaryLine s={feed.lastSummary} />}
              {feed.lastFetchedAt && (
                <p className="text-xs text-ink/40">Last checked {new Date(feed.lastFetchedAt).toLocaleString()}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
