import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatSalary, formatLocation, isUnresolvedCountry, commodityToSlug } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";
import { ApplyPanel } from "@/components/ApplyPanel";
import { ReportJobButton } from "@/components/ReportJobButton";
import { ShareJobButton } from "@/components/ShareJobButton";

/** schema.org/JobPosting structured data for Google Jobs indexing. */
function jobPostingJsonLd(job: any) {
  const employment: Record<string, string> = {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACTOR",
    CASUAL: "PER_DIEM",
    APPRENTICESHIP: "INTERN",
  };
  const data: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    // Google's JobPosting description field explicitly allows basic HTML, so
    // render markdown to HTML here rather than dumping raw markdown syntax.
    description: renderMarkdown(job.description),
    datePosted: job.publishedAt?.toISOString(),
    validThrough: job.expiresAt?.toISOString(),
    employmentType: employment[job.employmentType] ?? "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: job.company.website ?? undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city ?? undefined,
        addressRegion: job.region ?? undefined,
        // Never feed the "ZZ" unresolved-country sentinel to Google Jobs —
        // an absent field is far less wrong than a fake country.
        addressCountry: isUnresolvedCountry(job.countryCode) ? undefined : job.countryCode,
      },
    },
    directApply: true,
  };
  if (job.salaryMin || job.salaryMax) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salaryCurrency ?? "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salaryMin ?? undefined,
        maxValue: job.salaryMax ?? undefined,
        unitText: job.salaryPeriod === "HOUR" ? "HOUR" : job.salaryPeriod === "DAY" ? "DAY" : "YEAR",
      },
    };
  }
  return data;
}

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: { slug: string } }) {
  const job = await prisma.job.findUnique({
    where: { slug: params.slug },
    include: { company: true },
  });
  if (!job || job.status === "DRAFT" || job.status === "ARCHIVED") notFound();

  const session = await auth();
  let applied = false;
  let bookmarked = false;
  let candidate: {
    id: string;
    resumeKey: string | null;
    resumeName: string | null;
    coverLetterKey: string | null;
    coverLetterName: string | null;
  } | null = null;
  if (session?.user.role === "CANDIDATE") {
    candidate = await prisma.candidateProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, resumeKey: true, resumeName: true, coverLetterKey: true, coverLetterName: true },
    });
    if (candidate) {
      applied = Boolean(
        await prisma.application.findUnique({
          where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
        })
      );
      bookmarked = Boolean(
        await prisma.jobBookmark.findUnique({
          where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
        })
      );
    }
  }

  const pretty = (s?: string | null) => s?.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const closed = job.status === "EXPIRED";

  return (
    <article className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {job.status === "PUBLISHED" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(job)) }}
        />
      )}
      <div>
        <p className="text-sm text-ink/60">
          <Link href={`/companies/${job.company.slug}`} className="font-semibold text-oxide hover:underline">
            {job.company.name}
          </Link>
          {job.company.verificationStatus === "VERIFIED" && <span className="ml-1.5 text-patina">✓ Verified employer</span>}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-tight tracking-tight sm:text-4xl">
          {job.title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="tag">{formatLocation(job.city, job.region, job.countryCode)}</span>
          {job.fifo && <span className="tag !bg-hivis/15 !text-hivis-deep">FIFO{job.rosterPattern ? ` · ${job.rosterPattern} roster` : ""}</span>}
          {job.commodity && <span className="tag">{pretty(job.commodity)}</span>}
          {job.siteType && <span className="tag">{pretty(job.siteType)}</span>}
          <span className="tag">{pretty(job.employmentType)}</span>
          {salary && <span className="tag !bg-patina/10 !text-patina">{salary}</span>}
        </div>
        {job.commodity && (
          <p className="mt-2 text-xs text-ink/50">
            <Link href={`/salaries/${commodityToSlug(job.commodity)}`} className="underline">
              See typical {pretty(job.commodity)?.toLowerCase()} pay ranges →
            </Link>
          </p>
        )}
        <div className="strata mt-6 max-w-[160px]" aria-hidden="true" />
        <div
          className="mt-6 max-w-none text-ink/90"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(job.description) }}
        />
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start space-y-3">
        <ApplyPanel
          jobId={job.id}
          applyUrl={job.applyUrl}
          closed={closed}
          viewerRole={session?.user.role ?? null}
          applied={applied}
          bookmarked={bookmarked}
          defaultResumeKey={candidate?.resumeKey ?? null}
          defaultResumeName={candidate?.resumeName ?? null}
          defaultCoverLetterKey={candidate?.coverLetterKey ?? null}
          defaultCoverLetterName={candidate?.coverLetterName ?? null}
        />
        <div className="flex flex-wrap gap-2">
          <ShareJobButton title={job.title} companyName={job.company.name} />
          <ReportJobButton jobId={job.id} signedIn={Boolean(session?.user)} />
        </div>
      </aside>
    </article>
  );
}
