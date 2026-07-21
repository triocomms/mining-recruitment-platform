import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSearchResumeDatabase } from "@/lib/visibility";
import { scoreMatch } from "@/lib/matching";
import { Commodity, FifoPreference, SiteExperience } from "@prisma/client";

/**
 * Resume database search — Gold tier + verified employers only.
 * Only PUBLIC profiles are ever returned, and results are summaries;
 * full profile + files require the per-candidate visibility check.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  if (!(await canSearchResumeDatabase(user.id))) {
    return NextResponse.json(
      { error: "Resume database search is available on the Gold plan for verified employers.", action: "UPGRADE_GOLD" },
      { status: 403 }
    );
  }

  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim();
  const country = p.get("country")?.toUpperCase();
  const commodity = p.get("commodity") as Commodity | null;
  const site = p.get("site") as SiteExperience | null;
  const fifo = p.get("fifo") as FifoPreference | null;
  const jobId = p.get("jobId"); // rank against one of the employer's own jobs
  const page = Math.max(1, Number(p.get("page") ?? 1));

  // When ranking against a job, verify it belongs to this employer.
  let matchJob = null;
  if (jobId) {
    matchJob = await prisma.job.findFirst({
      where: { id: jobId, company: { ownerId: user.id } },
    });
    if (!matchJob) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const results = await prisma.candidateProfile.findMany({
    where: {
      visibility: "PUBLIC",
      user: { deletedAt: null },
      ...(country ? { countryCode: country } : {}),
      ...(commodity ? { commodities: { has: commodity } } : {}),
      ...(site ? { siteExperience: { has: site } } : {}),
      ...(fifo ? { fifoPreference: fifo } : {}),
      ...(q
        ? {
            OR: [
              { headline: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { certifications: { some: { name: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      headline: true,
      countryCode: true,
      region: true,
      yearsExperience: true,
      fifoPreference: true,
      commodities: true,
      siteExperience: true,
      certifications: { select: { name: true, expiresAt: true }, take: 6 },
    },
    orderBy: { updatedAt: "desc" },
    // With a match job we score a wider pool server-side, then rank.
    skip: matchJob ? 0 : (page - 1) * 20,
    take: matchJob ? 200 : 20,
  });

  if (matchJob) {
    const job = matchJob;
    const ranked = results
      .map((c) => {
        const { score, reasons } = scoreMatch({ candidate: c, job });
        return { ...c, matchScore: score, matchReasons: reasons };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice((page - 1) * 20, page * 20);
    return NextResponse.json({ results: ranked, page, rankedAgainst: job.title });
  }

  return NextResponse.json({ results, page });
}
