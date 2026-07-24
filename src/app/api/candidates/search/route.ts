import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSearchResumeDatabase } from "@/lib/visibility";
import { scoreMatch } from "@/lib/matching";
import { Commodity, FifoPreference, SiteExperience, Prisma } from "@prisma/client";

/**
 * Resume database search -- Gold tier + verified employers only.
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

  const baseWhere: Prisma.CandidateProfileWhereInput = {
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
  };

  const candidateSelect = {
    id: true,
    firstName: true,
    headline: true,
    countryCode: true,
    region: true,
    yearsExperience: true,
    fifoPreference: true,
    commodities: true,
    siteExperience: true,
    rightToWorkCountries: true,
    certifications: { select: { name: true, expiresAt: true, verificationStatus: true }, take: 6 },
    employmentHistory: {
      where: { verificationStatus: "VERIFIED" as const },
      select: { companyName: true, title: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" as const },
      take: 1,
    },
  } satisfies Prisma.CandidateProfileSelect;

  // Candidates with a currently-active "Promote Me" boost (paid, not expired).
  // This is a paid visibility boost, not a ranking signal -- it never touches
  // the job-matched score below.
  const activePromotions = await prisma.promotionListing.findMany({
    where: { paidAt: { not: null }, expiresAt: { gt: new Date() } },
    select: { candidateId: true },
  });
  const promotedIds = new Set(activePromotions.map((p) => p.candidateId));

  if (matchJob) {
    const job = matchJob;
    const results = await prisma.candidateProfile.findMany({
      where: baseWhere,
      select: candidateSelect,
      orderBy: { updatedAt: "desc" },
      // We score a wider pool server-side, then rank purely on match -- a
      // promotion never changes this order, it's merit-based only.
      skip: 0,
      take: 200,
    });
    const ranked = results
      .map((c) => {
        const { score, reasons } = scoreMatch({ candidate: c, job });
        return { ...c, matchScore: score, matchReasons: reasons, promoted: promotedIds.has(c.id) };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice((page - 1) * 20, page * 20);
    return NextResponse.json({ results: ranked, page, rankedAgainst: job.title });
  }

  // Non-job-ranked (default, recency-ordered) view: promoted candidates are
  // surfaced ahead of the normal list on page 1 only. They're excluded from
  // the normal query on every page so they never duplicate further down.
  type CandidateRow = Prisma.CandidateProfileGetPayload<{ select: typeof candidateSelect }>;
  let promoted: Array<CandidateRow & { promoted: true }> = [];
  if (page === 1 && promotedIds.size > 0) {
    const promotedResults = await prisma.candidateProfile.findMany({
      where: { ...baseWhere, id: { in: Array.from(promotedIds) } },
      select: candidateSelect,
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    promoted = promotedResults.map((c) => ({ ...c, promoted: true as const }));
  }

  const normalWhere: Prisma.CandidateProfileWhereInput =
    promotedIds.size > 0 ? { ...baseWhere, id: { notIn: Array.from(promotedIds) } } : baseWhere;

  const normalTake = page === 1 ? Math.max(0, 20 - promoted.length) : 20;
  const normalResults = await prisma.candidateProfile.findMany({
    where: normalWhere,
    select: candidateSelect,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * 20,
    take: normalTake,
  });

  const results = [...promoted, ...normalResults.map((c) => ({ ...c, promoted: false as const }))];
  return NextResponse.json({ results, page });
}
