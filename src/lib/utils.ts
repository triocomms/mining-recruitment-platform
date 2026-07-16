import slugify from "slugify";
import crypto from "crypto";

export function makeSlug(input: string) {
  return `${slugify(input, { lower: true, strict: true }).slice(0, 60)}-${crypto
    .randomBytes(3)
    .toString("hex")}`;
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
