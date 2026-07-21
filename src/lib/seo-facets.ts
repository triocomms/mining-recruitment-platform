import { Commodity, SiteExperience } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Programmatic SEO landing pages: facet (commodity, site type, or "fifo")
 * × region, generated only for combinations with live jobs so we never
 * serve thin/empty pages.
 */

export const facetSlug = (v: string) => v.toLowerCase().replace(/_/g, "-");
export const regionSlug = (r: string) =>
  r.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export type Facet =
  | { kind: "commodity"; value: Commodity; label: string }
  | { kind: "site"; value: SiteExperience; label: string }
  | { kind: "fifo"; value: "FIFO"; label: string };

const prettify = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function parseFacet(slug: string): Facet | null {
  if (slug === "fifo") return { kind: "fifo", value: "FIFO", label: "FIFO" };
  const enumish = slug.toUpperCase().replace(/-/g, "_");
  if ((Object.values(Commodity) as string[]).includes(enumish)) {
    return { kind: "commodity", value: enumish as Commodity, label: prettify(enumish) };
  }
  if ((Object.values(SiteExperience) as string[]).includes(enumish)) {
    return { kind: "site", value: enumish as SiteExperience, label: prettify(enumish) };
  }
  return null;
}

export function facetWhere(facet: Facet) {
  if (facet.kind === "commodity") return { commodity: facet.value };
  if (facet.kind === "site") return { siteType: facet.value };
  return { fifo: true };
}

export type FacetRegionCombo = {
  facetSlug: string;
  facetLabel: string;
  region: string; // raw stored region string, e.g. "Western Australia"
  regionSlug: string;
  count: number;
};

/**
 * Every facet×region combination that currently has at least one live job —
 * i.e. every /jobs/browse/{facet}/{region} page that actually resolves.
 * Shared by the browse index (src/app/jobs/browse/page.tsx) and the sitemap
 * so the two can never drift apart on which pages "count" as real.
 */
export async function getFacetRegionCombos(): Promise<FacetRegionCombo[]> {
  const jobs = await prisma.job.findMany({
    where: { status: "PUBLISHED", region: { not: null } },
    select: { commodity: true, siteType: true, fifo: true, region: true },
  });

  const combos = new Map<string, FacetRegionCombo>();
  const add = (facet: string, label: string, region: string) => {
    const key = `${facet}/${regionSlug(region)}`;
    const cur = combos.get(key);
    if (cur) cur.count++;
    else combos.set(key, { facetSlug: facet, facetLabel: label, region, regionSlug: regionSlug(region), count: 1 });
  };

  for (const j of jobs) {
    if (!j.region) continue;
    if (j.commodity) add(facetSlug(j.commodity), prettify(j.commodity), j.region);
    if (j.siteType) add(facetSlug(j.siteType), prettify(j.siteType), j.region);
    if (j.fifo) add("fifo", "FIFO", j.region);
  }

  return Array.from(combos.values());
}
