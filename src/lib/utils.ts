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

export function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
