import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dedupeLocationLabels } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;
const MIN_QUERY_LENGTH = 2;

/**
 * Typeahead source for the /jobs search (P1.6: job title + location first,
 * profile fields later). Suggestions are drawn straight from existing
 * PUBLISHED job data rather than a separate suggestions table — cheapest
 * thing that could work, and it can never suggest something with zero
 * results. Deliberately unauthenticated (same data already public on
 * /jobs) and short-circuited below MIN_QUERY_LENGTH to avoid a full-table
 * scan on every keystroke.
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json({ suggestions: [] });

  if (type === "title") {
    const jobs = await prisma.job.findMany({
      where: { status: "PUBLISHED", title: { contains: q, mode: "insensitive" } },
      select: { title: true },
      distinct: ["title"],
      orderBy: { publishedAt: "desc" },
      take: MAX_SUGGESTIONS,
    });
    return NextResponse.json({ suggestions: jobs.map((j) => j.title) });
  }

  if (type === "location") {
    // Over-fetch un-deduped rows, since several jobs share a city/region/
    // country combo — dedupeLocationLabels then formats + trims to
    // MAX_SUGGESTIONS.
    const jobs = await prisma.job.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { city: { contains: q, mode: "insensitive" } },
          { region: { contains: q, mode: "insensitive" } },
          { countryCode: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { city: true, region: true, countryCode: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ suggestions: dedupeLocationLabels(jobs, MAX_SUGGESTIONS) });
  }

  return NextResponse.json({ error: "type must be 'title' or 'location'" }, { status: 400 });
}
