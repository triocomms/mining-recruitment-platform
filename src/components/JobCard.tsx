import Link from "next/link";
import { formatSalary, formatLocation, timeAgo } from "@/lib/utils";
import type { Job, Company } from "@prisma/client";

const pretty = (s?: string | null) =>
  s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

export function JobCard({ job }: { job: Job & { company: Pick<Company, "name" | "slug" | "verificationStatus"> } }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className={`card block transition-shadow hover:shadow-md ${job.isPriority ? "border-l-4 border-l-hivis" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold leading-tight">{job.title}</h3>
          <p className="mt-0.5 text-sm text-ink/60">
            {job.company.name}
            {job.company.verificationStatus === "VERIFIED" && (
              <span className="ml-1.5 text-patina" title="Verified employer">✓ Verified</span>
            )}
          </p>
        </div>
        {job.publishedAt && <span className="shrink-0 text-xs text-ink/40">{timeAgo(job.publishedAt)}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="tag">{formatLocation(job.city, job.region, job.countryCode)}</span>
        {job.fifo && <span className="tag !bg-hivis/15 !text-hivis-deep">FIFO{job.rosterPattern ? ` ${job.rosterPattern}` : ""}</span>}
        {pretty(job.commodity) && <span className="tag">{pretty(job.commodity)}</span>}
        {pretty(job.siteType) && <span className="tag">{pretty(job.siteType)}</span>}
        <span className="tag">{pretty(job.employmentType)}</span>
        {salary && <span className="tag !bg-patina/10 !text-patina">{salary}</span>}
      </div>
    </Link>
  );
}
