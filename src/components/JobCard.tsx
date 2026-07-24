import Link from "next/link";
import { formatSalary, formatLocation, timeAgo } from "@/lib/utils";
import type { Job, Company } from "@prisma/client";

const pretty = (s?: string | null) =>
  s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

export function JobCard({
  job,
  topRight,
}: {
  job: Job & { company: Pick<Company, "name" | "slug" | "verificationStatus"> };
  /** Optional extra badge (e.g. a match% score) rendered above the timestamp
   * instead of overlapping it — see dashboard/candidate/page.tsx. */
  topRight?: React.ReactNode;
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className={`card block transition-shadow hover:shadow-md ${job.isPriority ? "border-l-4 border-l-hivis" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold leading-tight">{job.title}</h3>
          <p className="mt-0.5 text-sm text-ink/60">
            {job.company.name}
            {job.company.verificationStatus === "VERIFIED" && (
              <span className="ml-1.5 text-patina" title="Verified employer">✓ Verified</span>
            )}
          </p>
        </div>
        {(topRight || job.publishedAt) && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {topRight}
            {job.publishedAt && <span className="text-xs text-ink/40">{timeAgo(job.publishedAt)}</span>}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="tag">{formatLocation(job.city, job.region, job.countryCode)}</span>
        {job.fifo && <span className="tag !bg-hivis/15 !text-hivis-deep">FIFO{job.rosterPattern ? ` ${job.rosterPattern}` : ""}</span>}
        {pretty(job.commodity) && <span className="tag !bg-oregold/40 !text-oxide-deep">{pretty(job.commodity)}</span>}
        {pretty(job.siteType) && <span className="tag">{pretty(job.siteType)}</span>}
        <span className="tag">{pretty(job.employmentType)}</span>
        {salary && <span className="tag !bg-patina/10 !text-patina">{salary}</span>}
      </div>
    </Link>
  );
}
