"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button type="button" onClick={remove} disabled={busy} className="text-xs text-ink/40 underline">
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}
