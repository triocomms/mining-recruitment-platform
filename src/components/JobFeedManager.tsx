"use client";

import { useState } from "react";
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
};

function SummaryLine({ s }: { s: SyncSummary }) {
  return (
    <p className="text-sm text-ink/70">
      {s.fetched} in feed · {s.published} published · {s.pendingReview} pending review ·{" "}
      {s.draftedOverQuota} drafted (over quota) · {s.skippedDuplicates} already imported ·{" "}
      {s.expiredNoLongerInFeed} expired (removed from feed)
      {s.skippedTierCap > 0 && (
        <> · {s.skippedTierCap} not imported (plan limit reached — upgrade to import more)</>
      )}
      {s.skippedUnparseable > 0 && <> · {s.skippedUnparseable} skipped (unreadable)</>}
    </p>
  );
}

export function JobFeedManager({ initialFeeds }: { initialFeeds: Feed[] }) {
  const router = useRouter();
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedSummary, setLastAddedSummary] = useState<SyncSummary | null>(null);

  async function addFeed(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastAddedSummary(null);

    const res = await fetch("/api/jobs/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label: label || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add feed");
      return;
    }
    setFeeds((prev) => [data.feed, ...prev]);
    setLastAddedSummary(data.syncResult?.summary ?? null);
    setUrl("");
    setLabel("");
    router.refresh();
  }

  async function syncNow(feedId: string) {
    setSyncingId(feedId);
    const res = await fetch(`/api/jobs/feeds/${feedId}/sync`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSyncingId(null);
    if (res.ok) {
      setFeeds((prev) => prev.map((f) => (f.id === feedId ? data.feed : f)));
      router.refresh();
    }
  }

  async function toggleStatus(feed: Feed) {
    const nextStatus = feed.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    const res = await fetch(`/api/jobs/feeds/${feed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setFeeds((prev) => prev.map((f) => (f.id === feed.id ? data.feed : f)));
  }

  async function removeFeed(feedId: string) {
    if (!confirm("Remove this feed? Jobs already imported from it will stay on Orebridge.")) return;
    const res = await fetch(`/api/jobs/feeds/${feedId}`, { method: "DELETE" });
    if (res.ok) setFeeds((prev) => prev.filter((f) => f.id !== feedId));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addFeed} className="card space-y-3">
        <p className="text-sm text-ink/60">
          Point us at your careers RSS/XML feed and we&apos;ll keep your job listings in sync automatically —
          new roles get pulled in, and roles that disappear from your feed are expired here too. New jobs
          from a feed go to <span className="font-semibold">pending review</span> until we can confirm the
          location and commodity, or your account is trusted to auto-publish.
        </p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input
            type="url"
            required
            placeholder="https://careers.example.com/rss.xml"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="field"
          />
          <button type="submit" className="btn-dark" disabled={busy}>
            {busy ? "Adding…" : "Add feed"}
          </button>
        </div>
        {error && <p className="text-sm text-oxide" role="alert">{error}</p>}
        {lastAddedSummary && (
          <div className="rounded-md bg-bone p-3">
            <p className="mb-1 text-sm font-semibold">First sync complete</p>
            <SummaryLine s={lastAddedSummary} />
          </div>
        )}
      </form>

      {feeds.length === 0 ? (
        <p className="text-sm text-ink/60">No feeds connected yet.</p>
      ) : (
        <ul className="space-y-3">
          {feeds.map((feed) => (
            <li key={feed.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{feed.label || feed.url}</p>
                  {feed.label && <p className="text-xs text-ink/50">{feed.url}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`tag ${feed.status === "ERROR" ? "text-oxide" : ""}`}>{feed.status}</span>
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
