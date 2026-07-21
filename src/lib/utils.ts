import slugify from "slugify";
import crypto from "crypto";

export function makeSlug(input: string) {
  return `${slugify(input, { lower: true, strict: true }).slice(0, 60)}-${crypto
    .randomBytes(3)
    .toString("hex")}`;
}

/**
 * Sentinel used (RSS import, and now anywhere else that couldn't confidently
 * detect a country) when a real ISO 3166-1 code isn't known. Deliberately not
 * a real code, so it's unmistakable in the DB — but it must never reach a
 * public page or a search engine. Use isUnresolvedCountry()/formatLocation()
 * below anywhere a countryCode gets displayed or fed into structured data.
 */
export const UNRESOLVED_COUNTRY_CODE = "ZZ";

export function isUnresolvedCountry(countryCode?: string | null): boolean {
  return !countryCode || countryCode === UNRESOLVED_COUNTRY_CODE;
}

/** City/region/country as a human-readable string, silently dropping an
 * unresolved country rather than ever printing "ZZ" to a job seeker. */
export function formatLocation(
  city?: string | null,
  region?: string | null,
  countryCode?: string | null
): string {
  const parts = [city, region, isUnresolvedCountry(countryCode) ? null : countryCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location not specified";
}

export function formatSalary(
  min?: number | null,
  max?: number | null,
  currency?: string | null,
  period?: string | null
) {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 0 }).format(n);
  const range = min && max ? `${fmt(min)}–${fmt(max)}` : fmt((min ?? max)!);
  const per = period === "HOUR" ? "/hr" : period === "DAY" ? "/day" : period === "YEAR" ? "/yr" : "";
  return `${range}${per}`;
}

/** Commodity enum value <-> URL slug, e.g. "IRON_ORE" <-> "iron-ore". Used by
 * the /salaries benchmark pages. */
export function commodityToSlug(commodity: string): string {
  return commodity.toLowerCase().replace(/_/g, "-");
}

export function slugToCommodity(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "_");
}

/** Below this many salaried ads, a group's numbers are too thin to call a
 * "typical" range — the /salaries pages show "not enough data" instead of a
 * misleading average from one or two ads. */
export const MIN_SALARY_SAMPLE_SIZE = 3;

/**
 * Converts a YouTube/Vimeo watch link into an embeddable iframe src, or
 * returns null for anything else. Used both to validate a submitted
 * videoUrl (reject unsupported hosts rather than storing an arbitrary
 * iframe src) and to render it on the company page.
 */
export function toVideoEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.pathname.startsWith("/embed/")) return `https://www.youtube.com${u.pathname}`;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.slice(1);
    return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
