/**
 * One-off backfill: re-clean Job descriptions imported before the
 * stripHtml() ordering bug was fixed in src/lib/rss-feed.ts.
 *
 * Some RSS feeds (BHP's included) wrap description HTML in CDATA where the
 * tags themselves are also entity-escaped (e.g. "&lt;p style=...&gt;"). The
 * old stripHtml() decoded those entities *after* trying to strip tags, so
 * escaped tags survived stripping, then un-escaped into real (but never
 * stripped) HTML — which is what ended up stored in the DB and rendered
 * as literal text on the site.
 *
 * This script finds Job rows that still contain raw HTML in `description`
 * and re-runs the corrected stripHtml() against them. Safe to run more than
 * once — rows with already-clean descriptions are left untouched.
 *
 * Run with:  npx tsx scripts/clean-rss-descriptions.ts
 * (dry run first:  npx tsx scripts/clean-rss-descriptions.ts --dry-run)
 */
import { PrismaClient } from "@prisma/client";
import { stripHtml } from "../src/lib/rss-feed";

const prisma = new PrismaClient();

// Anything containing a tag-looking sequence, once entities are accounted
// for. Real stored bad rows contain literal "<p ...>", "<span ...>" etc.
const LOOKS_LIKE_HTML = /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await prisma.job.findMany({
    where: { source: "RSS" },
    select: { id: true, title: true, description: true },
  });

  const affected = candidates.filter((j) => LOOKS_LIKE_HTML.test(j.description));

  console.log(`Scanned ${candidates.length} RSS jobs, ${affected.length} have raw HTML in description.`);

  for (const job of affected) {
    const cleaned = stripHtml(job.description) || job.title;
    console.log(`\n--- ${job.id} :: ${job.title} ---`);
    console.log("before:", job.description.slice(0, 120).replace(/\n/g, "\\n"));
    console.log("after: ", cleaned.slice(0, 120).replace(/\n/g, "\\n"));

    if (!dryRun) {
      await prisma.job.update({
        where: { id: job.id },
        data: { description: cleaned.slice(0, 8000) },
      });
    }
  }

  console.log(dryRun ? "\nDry run only — no rows updated." : `\nUpdated ${affected.length} row(s).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
