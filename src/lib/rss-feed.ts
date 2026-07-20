import { XMLParser } from "fast-xml-parser";
import type { Commodity } from "@prisma/client";

/**
 * RSS/XML job feed parsing + normalization.
 *
 * Generic employer career feeds (Workday, SuccessFactors, iCIMS, the Google
 * Jobs `g:` namespace used by BHP and many other large employers) give a
 * clean title/link/id but bury location, roster and commodity inside free
 * text. We extract what we can confidently infer and leave the rest null —
 * guessing wrong (e.g. wrong commodity) is worse than an employer filling a
 * blank field after import. See feed-import.ts for how these rows become
 * PENDING_REVIEW / DRAFT / PUBLISHED Job rows.
 */

export type RawFeedItem = {
  title: string;
  link?: string;
  guid?: string;
  description?: string;
  gId?: string;
  gLocation?: string;
  gEmployer?: string;
  gExpirationDate?: string;
};

export type NormalizedFeedJob = {
  title: string;
  description: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  commodity: Commodity | null;
  fifo: boolean;
  rosterPattern: string | null;
  applyUrl: string | null;
  externalRef: string;
  needsReview: boolean; // true when key fields (country, commodity) couldn't be inferred
};

/** ---------- XML parsing ---------- */

export function parseFeedXml(xml: string): RawFeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
    trimValues: true,
  });
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new Error("Could not parse feed as XML");
  }

  const channel = doc?.rss?.channel;
  if (!channel) throw new Error("Not a recognizable RSS 2.0 feed (missing <rss><channel>)");

  const rawItems = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  if (rawItems.length === 0) return [];

  const text = (v: any): string | undefined => {
    if (v == null) return undefined;
    if (typeof v === "string") return v.trim() || undefined;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object" && "__cdata" in v) return String(v.__cdata).trim() || undefined;
    if (typeof v === "object" && "#text" in v) return String(v["#text"]).trim() || undefined;
    return undefined;
  };

  return rawItems.map((item: any) => ({
    title: text(item.title) ?? "",
    link: text(item.link),
    guid: text(item.guid?.["#text"] ?? item.guid),
    description: text(item.description),
    gId: text(item["g:id"]),
    gLocation: text(item["g:location"]),
    gEmployer: text(item["g:employer"]),
    gExpirationDate: text(item["g:expiration_date"]),
  }));
}

/** ---------- Field inference ---------- */

// Country names/aliases as they commonly appear in career-feed titles and
// g:location fields, mapped to ISO 3166-1 alpha-2. Extend as needed —
// unmatched countries just leave countryCode null (job goes to review queue).
const COUNTRY_MAP: Record<string, string> = {
  australia: "AU",
  canada: "CA",
  chile: "CL",
  "united states": "US",
  usa: "US",
  peru: "PE",
  brazil: "BR",
  "south africa": "ZA",
  mongolia: "MN",
  kazakhstan: "KZ",
  "papua new guinea": "PG",
  indonesia: "ID",
  zambia: "ZM",
  "democratic republic of congo": "CD",
  drc: "CD",
  "united kingdom": "GB",
  uk: "GB",
  mexico: "MX",
  argentina: "AR",
  colombia: "CO",
  philippines: "PH",
  ghana: "GH",
  "new zealand": "NZ",
  suriname: "SR",
  guinea: "GN",
};

const COMMODITY_KEYWORDS: [RegExp, Commodity][] = [
  [/\biron\s*ore\b/i, "IRON_ORE"],
  [/\bcoal\b|\bcoking\b|\bmetallurgical\s+coal\b/i, "COAL"],
  [/\bcopper\b/i, "COPPER"],
  [/\bgold\b/i, "GOLD"],
  [/\blithium\b/i, "LITHIUM"],
  [/\bnickel\b/i, "NICKEL"],
  [/\bbauxite\b|\balumina\b/i, "BAUXITE_ALUMINA"],
  [/\buranium\b/i, "URANIUM"],
  [/\bmineral\s+sands\b/i, "MINERAL_SANDS"],
  [/\brare\s+earths?\b/i, "RARE_EARTHS"],
  [/\bzinc\b|\blead[\s-]?zinc\b|\bzinc[\s-]?lead\b|\bgalena\b|\blead\s+concentrate/i, "ZINC_LEAD"],
  [/\boil\s*(and|&)?\s*gas\b|\bpetroleum\b/i, "OIL_GAS"],
  // Common mining commodities without a dedicated enum value.
  [/\bpotash\b|\bdiamonds?\b|\bmanganese\b|\btin\b|\bcobalt\b|\bsilver\b/i, "OTHER"],
];

const FIFO_RE = /\bFIFO\b/i;
const ROSTER_RE = /\b(\d{1,2}\s?[\/x]\s?\d{1,2})\b/i;

function guessCountryCode(...texts: (string | undefined)[]): string | null {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (hay.includes(name)) return code;
  }
  return null;
}

function guessCommodity(...texts: (string | undefined)[]): Commodity | null {
  const hay = texts.filter(Boolean).join(" ");
  for (const [re, commodity] of COMMODITY_KEYWORDS) {
    if (re.test(hay)) return commodity;
  }
  return null;
}

/** "Senior Electrical Engineer | Perth (Australia)" -> { headline, city, countryName } */
function splitTitle(rawTitle: string): { headline: string; city: string | null } {
  // Strip a trailing "(Country)" segment.
  const withoutCountry = rawTitle.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const segments = withoutCountry.split("|").map((s) => s.trim()).filter(Boolean);
  const headline = segments[0] || withoutCountry || rawTitle;
  // Middle/last segments after the role are usually site/city, e.g.
  // "Dragline Operators | Saraji | BMA" -> "Saraji" is the likely site.
  // Skip segments that look like an employer name (all-caps acronym) or a
  // roster pattern — those aren't a city.
  const NON_PLACE_SEGMENT_RE = /^(talent\s+pool|expression\s+of\s+interest|various\s+locations?|multiple\s+locations?)$/i;
  const candidateSegments = segments
    .slice(1)
    .filter((s) => !ROSTER_RE.test(s) && !FIFO_RE.test(s) && !NON_PLACE_SEGMENT_RE.test(s));
  const city = candidateSegments.find((s) => !/^[A-Z&]{2,6}$/.test(s)) ?? null;
  return { headline, city };
}

function stripHtml(html: string): string {
  return html
    // block-level tags become paragraph breaks before we strip everything else
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/** Normalize one raw feed item into the same shape CSV import rows use. */
export function normalizeFeedItem(item: RawFeedItem): NormalizedFeedJob | null {
  if (!item.title || item.title.length < 4) return null;

  const externalRef = item.gId || item.guid || item.link;
  if (!externalRef) return null; // nothing stable to dedupe on — skip

  const { headline, city } = splitTitle(item.title);
  const description = item.description ? stripHtml(item.description) : "";
  const countryCode = guessCountryCode(item.title, item.gLocation);
  const commodity = guessCommodity(item.title, description.slice(0, 2000));
  const fifo = FIFO_RE.test(item.title) || FIFO_RE.test(description.slice(0, 2000));
  const rosterMatch = item.title.match(ROSTER_RE) || description.slice(0, 2000).match(ROSTER_RE);
  const rosterPattern = rosterMatch ? rosterMatch[1].replace(/\s+/g, "").replace("x", "/") : null;

  return {
    title: headline.slice(0, 120),
    description: description.slice(0, 8000) || headline,
    countryCode,
    region: null,
    city,
    commodity,
    fifo,
    rosterPattern,
    applyUrl: item.link ?? null,
    externalRef: String(externalRef).slice(0, 80),
    needsReview: !countryCode || !commodity,
  };
}

export function parseAndNormalizeFeed(xml: string): {
  jobs: NormalizedFeedJob[];
  skipped: number;
} {
  const items = parseFeedXml(xml);
  const jobs: NormalizedFeedJob[] = [];
  let skipped = 0;
  for (const item of items) {
    const normalized = normalizeFeedItem(item);
    if (normalized) jobs.push(normalized);
    else skipped++;
  }
  return { jobs, skipped };
}
