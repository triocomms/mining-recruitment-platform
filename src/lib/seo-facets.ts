import { Commodity, SiteExperience } from "@prisma/client";

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
