"use client";

import Link from "next/link";
import { createElement as h } from "react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "fifodido_featured_camps_shown";

type CampCard = {
  id: string;
  slug: string;
  name: string;
  heroImageKey: string | null;
  operatorCompanyName: string | null;
  location: string;
  commodityLabel: string | null;
  accessTypeLabel: string | null;
  rosterPatterns: string[];
  jobCount: number;
};

/**
 * Replaces the default (no-filters) sites list with a single randomly
 * chosen "Featured camp" card. Picks a new site on every page load, but
 * avoids repeating a camp within the same browser session (tracked via
 * sessionStorage) until every candidate has had a turn, at which point
 * the pool resets. Falls back to a skeleton for the one render before
 * the client has picked, since the choice can't be known during SSR.
 */
export function FeaturedCamp({ sites }: { sites: CampCard[] }) {
  const [site, setSite] = useState<CampCard | null>(null);

  useEffect(() => {
    if (sites.length === 0) return;

    let shown: string[] = [];
    try {
      shown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
      if (!Array.isArray(shown)) shown = [];
    } catch {
      shown = [];
    }

    let available = sites.filter((s) => !shown.includes(s.id));
    if (available.length === 0) {
      shown = [];
      available = sites;
    }

    const pick = available[Math.floor(Math.random() * available.length)];
    setSite(pick);

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...shown, pick.id]));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — randomness
      // still works, it just won't dedupe across page loads.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites.map((s) => s.id).join(",")]);

  if (!site) {
    return h("div", { className: "card mt-4 h-64 animate-pulse bg-bone" });
  }

  return h(
    "div",
    { className: "mt-4" },
    h("p", { className: "text-xs font-semibold uppercase tracking-wide text-ink/50" }, "Featured camp"),
    h(
      Link,
      {
        href: "/sites/" + site.slug,
        className: "card mt-2 block transition-shadow hover:shadow-md sm:flex sm:gap-5",
      },
      site.heroImageKey &&
        h("img", {
          src: "/api/files?key=" + encodeURIComponent(site.heroImageKey),
          alt: "",
          className: "mb-3 h-48 w-full rounded-md object-cover sm:mb-0 sm:h-auto sm:w-64 sm:shrink-0",
        }),
      h(
        "div",
        { className: "min-w-0" },
        h("h2", { className: "font-display text-2xl font-semibold leading-tight" }, site.name),
        site.operatorCompanyName && h("p", { className: "text-xs text-ink/50" }, site.operatorCompanyName),
        h("p", { className: "mt-0.5 text-sm text-ink/60" }, site.location),
        h(
          "div",
          { className: "mt-3 flex flex-wrap gap-1.5" },
          site.commodityLabel && h("span", { className: "tag !bg-oregold/40 !text-oxide-deep" }, site.commodityLabel),
          site.accessTypeLabel && h("span", { className: "tag !bg-hivis/15 !text-hivis-deep" }, site.accessTypeLabel),
          ...site.rosterPatterns.map((r) => h("span", { key: r, className: "tag" }, r))
        ),
        h(
          "p",
          { className: "mt-2 text-xs text-ink/50" },
          site.jobCount + " live " + (site.jobCount === 1 ? "job" : "jobs")
        )
      )
    )
  );
}
