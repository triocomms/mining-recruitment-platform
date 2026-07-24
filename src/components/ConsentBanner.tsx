"use client";

import { useEffect, useState } from "react";

/**
 * Cookie/analytics consent (GDPR/CCPA). Only strictly-necessary cookies
 * (session auth) are used before consent; analytics load only after opt-in.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!document.cookie.includes("ob_consent=")) setVisible(true);
  }, []);

  function choose(value: "accepted" | "essential") {
    document.cookie = `ob_consent=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setVisible(false);
    if (value === "accepted") {
      // Analytics would be initialized here, never before consent.
    }
  }

  if (!visible) return null;
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-line bg-bone p-4 text-ink">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink/70">
          We use essential cookies to keep you signed in. Optional analytics cookies help us improve the
          site — used only if you agree. <a href="/privacy" className="underline">How we handle your data</a>
        </p>
        <div className="flex gap-2">
          <button onClick={() => choose("essential")} className="btn-ghost">Essential only</button>
          <button onClick={() => choose("accepted")} className="btn-primary">Accept all</button>
        </div>
      </div>
    </div>
  );
}
