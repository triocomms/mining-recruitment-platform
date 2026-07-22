/**
 * Resume parsing (P2.7) — heuristic, keyword-based extraction only. No
 * external API, no LLM call, nothing leaves the server: this was an
 * explicit choice (see the P2.7 check-in) to avoid an ongoing per-parse
 * cost or a new vendor. Accuracy is necessarily rougher than an
 * LLM/vendor parser would give — every suggested field is merged into the
 * profile form as a *gap-filler* (existing values are never overwritten)
 * and the candidate must still hit "Save profile" themselves, so a wrong
 * guess just means one extra edit rather than bad data landing silently.
 *
 * Style matches the keyword-inference already used for RSS job imports
 * (see normalizeFeedItem in rss-feed.ts) — same tradeoff, same shape.
 */

export type ParsedResumeFields = {
  phone?: string;
  yearsExperience?: number;
  fifoPreference?: "FIFO" | "DIDO" | "RESIDENTIAL" | "FLEXIBLE";
  siteExperience?: string[];
  commodities?: string[];
  certifications?: string[];
};

/** Sniffs the file kind from its magic bytes rather than trusting an
 *  extension or a stored content-type — resume object keys carry neither
 *  (see presignUpload in s3.ts). */
export function detectResumeFileKind(buffer: Buffer): "pdf" | "docx" | "unknown" {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  // .docx (and any OOXML/zip-based format) starts with the ZIP local file
  // header signature.
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "docx";
  }
  return "unknown";
}

const SITE_KEYWORDS: [string, RegExp][] = [
  ["OPEN_PIT", /open[\s-]?pit/i],
  ["UNDERGROUND", /underground/i],
  ["PROCESSING_PLANT", /processing plant/i],
  ["EXPLORATION", /exploration/i],
  ["PORT_RAIL", /\bport\b|\brail\b/i],
  ["SMELTER_REFINERY", /smelter|refinery/i],
  ["WORKSHOP_MAINTENANCE", /workshop|maintenance/i],
  ["CORPORATE_OFFICE", /corporate|head office/i],
];

const COMMODITY_KEYWORDS: [string, RegExp][] = [
  ["GOLD", /\bgold\b/i],
  ["IRON_ORE", /iron\s*ore/i],
  ["COAL", /\bcoal\b/i],
  ["COPPER", /\bcopper\b/i],
  ["LITHIUM", /\blithium\b/i],
  ["NICKEL", /\bnickel\b/i],
  ["BAUXITE_ALUMINA", /bauxite|alumina/i],
  ["URANIUM", /\buranium\b/i],
  ["MINERAL_SANDS", /mineral\s*sands/i],
  ["RARE_EARTHS", /rare\s*earths?/i],
  // "lead" alone is too common a word (leadership, "led a team") to key off
  // safely, so ZINC_LEAD only triggers on the much less ambiguous "zinc".
  ["ZINC_LEAD", /\bzinc\b/i],
  ["OIL_GAS", /oil\s*(&|and)?\s*gas|\bpetroleum\b/i],
];

// Canonical display casing, matched case-insensitively against the resume text.
const KNOWN_CERTIFICATIONS = [
  "White Card",
  "Construction Induction",
  "Working at Heights",
  "Confined Space",
  "First Aid",
  "CPR",
  "HR Licence",
  "MR Licence",
  "Forklift Licence",
  "Dogman",
  "Rigger",
  "Standard 11",
  "Gas Test Atmospheres",
  "Elevated Work Platform",
  "EWP",
  "Chain of Responsibility",
];

/** First phone-shaped run of digits (8–13 digits, allowing spaces, dashes,
 *  parens, and a leading +) found in the text, normalized to single spaces. */
function extractPhone(text: string): string | undefined {
  const candidates = text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? [];
  for (const raw of candidates) {
    const digitCount = (raw.match(/\d/g) ?? []).length;
    if (digitCount >= 8 && digitCount <= 13) {
      return raw.trim().replace(/\s+/g, " ");
    }
  }
  return undefined;
}

/** First "N years" / "N+ years" / "N yrs" mention, capped at a sane upper
 *  bound so a stray unrelated number (e.g. a postcode-adjacent "2024
 *  years"-shaped false match) can't produce nonsense. */
function extractYearsExperience(text: string): number | undefined {
  const match = text.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\b/i);
  if (!match) return undefined;
  const years = Number(match[1]);
  return years >= 0 && years <= 50 ? years : undefined;
}

/** FIFO > DIDO > RESIDENTIAL > FLEXIBLE — first explicit whole-word mention
 *  wins; nothing is guessed if none of these are stated outright. */
function extractFifoPreference(text: string): ParsedResumeFields["fifoPreference"] {
  if (/\bfifo\b/i.test(text)) return "FIFO";
  if (/\bdido\b/i.test(text)) return "DIDO";
  if (/\bresidential\b/i.test(text)) return "RESIDENTIAL";
  if (/\bflexible\b/i.test(text)) return "FLEXIBLE";
  return undefined;
}

function extractSiteExperience(text: string): string[] {
  return SITE_KEYWORDS.filter(([, re]) => re.test(text)).map(([value]) => value);
}

function extractCommodities(text: string): string[] {
  return COMMODITY_KEYWORDS.filter(([, re]) => re.test(text)).map(([value]) => value);
}

function extractCertifications(text: string): string[] {
  const lower = text.toLowerCase();
  return KNOWN_CERTIFICATIONS.filter((cert) => lower.includes(cert.toLowerCase()));
}

/** Runs every field extractor against raw resume text (already converted
 *  from PDF/DOCX to plain text by the caller) and returns only the fields
 *  it found something for — omitted keys mean "no suggestion", not "blank
 *  it out". */
export function extractResumeFields(text: string): ParsedResumeFields {
  const result: ParsedResumeFields = {};

  const phone = extractPhone(text);
  if (phone) result.phone = phone;

  const yearsExperience = extractYearsExperience(text);
  if (yearsExperience !== undefined) result.yearsExperience = yearsExperience;

  const fifoPreference = extractFifoPreference(text);
  if (fifoPreference) result.fifoPreference = fifoPreference;

  const siteExperience = extractSiteExperience(text);
  if (siteExperience.length > 0) result.siteExperience = siteExperience;

  const commodities = extractCommodities(text);
  if (commodities.length > 0) result.commodities = commodities;

  const certifications = extractCertifications(text);
  if (certifications.length > 0) result.certifications = certifications;

  return result;
}
