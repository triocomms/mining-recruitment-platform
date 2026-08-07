"use client";

import Link from "next/link";
import { createElement as h } from "react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "fifodido_featured_companies_shown";

type CompanyCard = {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  verified: boolean;
  countryLabel: string | null;
  profileText: string | null;
  commodityLabels: string[];
};

/**
 * Replaces the default (no-filters) companies list with a single randomly
 * chosen "Featured company" card. Picks a new company on every page load,
 * but avoids repeating one within the same browser session (tracked via
 * sessionStorage, using a key distinct from the Sites page's Featured Camp
 * feature) until every candidate has had a turn, at which point the pool
 * resets. Falls back to a skeleton for the one render before the client has
 * picked, since the choice can't be known during SSR.
 */
export function FeaturedCompany({ companies }: { companies: CompanyCard[] }) {
  const [company, setCompany] = useState<CompanyCard | null>(null);

  useEffect(() => {
    if (companies.length === 0) return;

    let shown: string[] = [];
    try {
      shown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
      if (!Array.isArray(shown)) shown = [];
    } catch {
      shown = [];
    }

    let available = companies.filter((c) => !shown.includes(c.id));
    if (available.length === 0) {
      shown = [];
      available = companies;
    }

    const pick = available[Math.floor(Math.random() * available.length)];
    setCompany(pick);

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...shown, pick.id]));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — randomness
      // still works, it just won't dedupe across page loads.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.map((c) => c.id).join(",")]);

  if (!company) {
    return h("div", { className: "card mt-4 h-64 animate-pulse bg-bone" });
  }

  return h(
    "div",
    { className: "mt-4" },
    h("p", { className: "text-xs font-semibold uppercase tracking-wide text-ink/50" }, "Featured company"),
    h(
      Link,
      {
        href: "/companies/" + company.slug,
        className: "card mt-2 block transition-shadow hover:shadow-md sm:flex sm:gap-5",
      },
      h(
        "div",
        { className: "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-white sm:h-auto sm:w-40" },
        company.logoKey
          ? h("img", {
              src: "/api/files?key=" + encodeURIComponent(company.logoKey),
              alt: company.name + " logo",
              className: "h-full w-full object-contain",
            })
          : h("span", { className: "font-display text-2xl uppercase text-ink/20" }, company.name.slice(0, 1))
      ),
      h(
        "div",
        { className: "mt-3 min-w-0 sm:mt-0" },
        h(
          "h2",
          { className: "font-display text-2xl font-semibold leading-tight" },
          company.name,
          company.verified &&
            h("span", { className: "ml-2 align-middle text-lg text-patina", title: "Verified employer" }, "✓")
        ),
        company.countryLabel && h("p", { className: "mt-0.5 text-sm text-ink/60" }, company.countryLabel),
        company.profileText && h("p", { className: "mt-2 line-clamp-3 text-sm text-ink/70" }, company.profileText),
        company.commodityLabels.length > 0 &&
          h(
            "div",
            { className: "mt-3 flex flex-wrap gap-1.5" },
            ...company.commodityLabels.map((c) => h("span", { key: c, className: "tag !bg-oregold/40 !text-oxide-deep" }, c))
          ),
        h("p", { className: "mt-3 text-xs font-semibold text-hivis" }, "View full profile →")
      )
    )
  );
}
