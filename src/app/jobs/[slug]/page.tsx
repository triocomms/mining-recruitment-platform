import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatSalary } from "@/lib/utils";
import { ApplyPanel } from "@/components/ApplyPanel";

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
  if (session?.user.role === "CANDIDATE") {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId: session.user.id } });
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
          <span className="tag">{[job.city, job.region, job.countryCode].filter(Boolean).join(", ")}</span>
          {job.fifo && <span className="tag !bg-hivis/15 !text-hivis-deep">FIFO{job.rosterPattern ? ` · ${job.rosterPattern} roster` : ""}</span>}
          {job.commodity && <span className="tag">{pretty(job.commodity)}</span>}
          {job.siteType && <span className="tag">{pretty(job.siteType)}</span>}
          <span className="tag">{pretty(job.employmentType)}</span>
          {salary && <span className="tag !bg-patina/10 !text-patina">{salary}</span>}
        </div>
        <div className="strata mt-6 max-w-[160px]" aria-hidden="true" />
        <div className="prose-sm mt-6 max-w-none whitespace-pre-wrap text-ink/90">{job.description}</div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <ApplyPanel
          jobId={job.id}
          applyUrl={job.applyUrl}
          closed={closed}
          viewerRole={session?.user.role ?? null}
          applied={applied}
          bookmarked={bookmarked}
        />
      </aside>
    </article>
  );
}
