/**
 * Regression check for the "ZZ" country-sentinel bug: a job whose country
 * couldn't be detected must never (a) auto-publish, or (b) render its raw
 * country code on a public page.
 *
 * This repo has no test framework set up, so this is a standalone assertion
 * script (same pattern as scripts/clean-rss-descriptions.ts) rather than a
 * proper unit test — run it manually after touching anything in this area:
 *
 *   npx tsx scripts/test-no-unresolved-country-leak.ts
 *
 * It exits non-zero on failure so it's CI-friendly if a test runner gets
 * added later.
 */
import { formatLocation, isUnresolvedCountry, UNRESOLVED_COUNTRY_CODE } from "../src/lib/utils";
import { jobHasUnresolvedFields } from "../src/lib/moderation";
import { normalizeFeedItem } from "../src/lib/rss-feed";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "ok " : "FAIL"} — ${label}${pass ? "" : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  if (!pass) failures++;
}

// 1. The sentinel itself is what we think it is.
check("UNRESOLVED_COUNTRY_CODE is ZZ", UNRESOLVED_COUNTRY_CODE, "ZZ");
check("isUnresolvedCountry(ZZ)", isUnresolvedCountry("ZZ"), true);
check("isUnresolvedCountry(null)", isUnresolvedCountry(null), true);
check("isUnresolvedCountry(undefined)", isUnresolvedCountry(undefined), true);
check("isUnresolvedCountry('')", isUnresolvedCountry(""), true);
check("isUnresolvedCountry(AU) is false", isUnresolvedCountry("AU"), false);

// 2. formatLocation never contains the literal string "ZZ", with or without
//    city/region present, and never crashes on an all-blank job.
check("formatLocation hides ZZ, keeps city/region", formatLocation("Perth", "WA", "ZZ"), "Perth, WA");
check("formatLocation hides ZZ with nothing else", formatLocation(null, null, "ZZ"), "Location not specified");
check("formatLocation with a real country", formatLocation("Perth", "WA", "AU"), "Perth, WA, AU");
const neverContainsZZ = [
  formatLocation("Perth", "WA", "ZZ"),
  formatLocation(null, null, "ZZ"),
  formatLocation(undefined, undefined, undefined),
].every((s) => !/\bZZ\b/.test(s));
check("no formatLocation output contains ZZ as a token", neverContainsZZ, true);

// 3. jobHasUnresolvedFields — the gate every publish path (CSV, manual,
//    admin approve) now checks before setting status to PUBLISHED.
check("jobHasUnresolvedFields(ZZ) blocks", jobHasUnresolvedFields({ countryCode: "ZZ" }), true);
check("jobHasUnresolvedFields(AU) allows", jobHasUnresolvedFields({ countryCode: "AU" }), false);

// 4. End-to-end: an RSS feed item with no detectable country/commodity
//    (a generic ad with nothing in COUNTRY_MAP) must come out of
//    normalizeFeedItem flagged needsReview — feed-import.ts's cleanEnough
//    check depends on this to keep it out of PUBLISHED.
const undetectable = normalizeFeedItem({
  title: "Site Coordinator",
  link: "https://example.com/jobs/123",
  guid: "job-123",
  description: "Join our team on an exciting new project. Competitive pay.",
});
check("undetectable feed item exists", undetectable !== null, true);
if (undetectable) {
  check("undetectable feed item has countryCode null", undetectable.countryCode, null);
  check("undetectable feed item sets needsReview", undetectable.needsReview, true);
  check(
    "formatLocation on the undetectable job's fallback ('ZZ' as feed-import.ts would store it) hides it",
    formatLocation(undetectable.city, undetectable.region, "ZZ"),
    formatLocation(undetectable.city, undetectable.region, null)
  );
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
