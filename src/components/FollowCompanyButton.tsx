"use client";

import { useState } from "react";

export function FollowCompanyButton({
  companyId,
  following: initialFollowing,
  viewerRole,
}: {
  companyId: string;
  following: boolean;
  viewerRole: "CANDIDATE" | "EMPLOYER" | "ADMIN" | null;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (viewerRole !== "CANDIDATE") return null;

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) setFollowing((await res.json()).following);
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} className="btn-ghost disabled:opacity-50">
      {following ? "✓ Following" : "+ Follow company"}
    </button>
  );
}
