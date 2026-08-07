import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import type { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_ORDER: { key: ApplicationStatus; label: string; tone: string }[] = [
  { key: "SUBMITTED", label: "Submitted", tone: "bg-ink/30" },
  { key: "VIEWED", label: "Viewed", tone: "bg-ink/30" },
  { key: "SHORTLISTED", label: "Shortlisted", tone: "bg-patina" },
  { key: "INTERVIEW", label: "Interview", tone: "bg-patina" },
  { key: "OFFER", label: "Offer", tone: "bg-oregold" },
  { key: "REJECTED", label: "Rejected", tone: "bg-oxide" },
  { key: "WITHDRAWN", label: "Withdrawn", tone: "bg-ink/30" },
];

const shortDate = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });

/** Buckets a list of timestamps into a daily count series covering the last
 *  `days` days (including today), filling gaps with zero so the chart never
 *  skips a day just because nothing happened on it. */
function buildDailySeries(dates: Date[], days: number): { date: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const series: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: shortDate(d), value: counts.get(key) ?? 0 });
  }
  return series;
}

export default async function EmployerAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({ where: { ownerId: session.user.id } });
  if (!company) redirect("/login");

  const jobs = await prisma.job.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: { select: { applications: true, bookmarks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalJobs = jobs.length;
  const liveJobs = jobs.filter((j) => j.status === "PUBLISHED").length;
  const totalApplications = jobs.reduce((sum, j) => sum + j._count.applications, 0);

  // Funnel counts -- grouped across every job this company has ever posted,
  // not just the currently-live ones.
  const statusCounts = await prisma.application.groupBy({
    by: ["status"],
    where: { job: { companyId: company.id } },
    _count: { _all: true },
  });
  const countsByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all])
  ) as Partial<Record<ApplicationStatus, number>>;

  // interviewedAt is set once, the first time an application ever reaches
  // INTERVIEW or OFFER (see prisma/schema.prisma) -- so this is a genuine
  // "time to interview" figure, not skewed by later status changes.
  const interviewed = await prisma.application.findMany({
    where: { job: { companyId: company.id }, interviewedAt: { not: null } },
    select: { createdAt: true, interviewedAt: true },
  });
  const avgDaysToInterview = interviewed.length
    ? Math.round(
        interviewed.reduce((sum, a) => sum + (a.interviewedAt!.getTime() - a.createdAt.getTime()), 0) /
          interviewed.length /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);
  const recentApplications = await prisma.application.findMany({
    where: { job: { companyId: company.id }, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const series = buildDailySeries(
    recentApplications.map((a) => a.createdAt),
    30
  );

  const topJobs = [...jobs].sort((a, b) => b._count.applications - a._count.applications).slice(0, 5);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Analytics</h1>
        <Link href="/dashboard/employer" className="text-sm underline">← Employer dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        How your job postings are performing, across every ad you&rsquo;ve ever run.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="label">Jobs posted</p>
          <p className="font-display text-2xl">{totalJobs}</p>
        </div>
        <div className="card">
          <p className="label">Live now</p>
          <p className="font-display text-2xl">{liveJobs}</p>
        </div>
        <div className="card">
          <p className="label">Total applications</p>
          <p className="font-display text-2xl">{totalApplications}</p>
        </div>
        <div className="card">
          <p className="label">Avg. days to interview</p>
          <p className="font-display text-2xl">{avgDaysToInterview ?? "—"}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl uppercase tracking-wide">Applications, last 30 days</h2>
        <div className="card mt-3">
          <AnalyticsChart points={series} color="#0F6E56" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl uppercase tracking-wide">Applicant funnel</h2>
        <div className="card mt-3 space-y-3">
          {totalApplications === 0 ? (
            <p className="text-sm text-ink/60">No applications yet.</p>
          ) : (
            STATUS_ORDER.map(({ key, label, tone }) => {
              const count = countsByStatus[key] ?? 0;
              const pct = totalApplications ? Math.round((count / totalApplications) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-ink/60">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-ink/10">
                    <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase tracking-wide">Top jobs by applications</h2>
          <Link href="/dashboard/employer/jobs" className="text-sm underline">Manage all →</Link>
        </div>
        {topJobs.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No jobs posted yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-line text-ink/50">
                  <th className="py-1 pr-3">Job</th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1 pr-3">Applications</th>
                  <th className="py-1 pr-3">Saves</th>
                  <th className="py-1">Posted</th>
                </tr>
              </thead>
              <tbody>
                {topJobs.map((j) => (
                  <tr key={j.id} className="border-b border-ink-line/50">
                    <td className="py-1 pr-3">
                      <Link href={`/jobs/${j.slug}`} className="underline">{j.title}</Link>
                    </td>
                    <td className="py-1 pr-3">
                      <span className={`tag ${j.status === "PUBLISHED" ? "bg-patina/15 text-patina" : ""}`}>
                        {j.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-1 pr-3">{j._count.applications}</td>
                    <td className="py-1 pr-3">{j._count.bookmarks}</td>
                    <td className="py-1">{shortDate(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
