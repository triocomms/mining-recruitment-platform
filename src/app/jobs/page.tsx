import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { isUnresolvedCountry } from "@/lib/utils";
import { Commodity, SiteExperience } from "@prisma/client";

export const metadata = { title: "Browse mining & resources jobs" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string; country?: string; commodity?: string; site?: string; fifo?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = searchParams.q?.trim();

  const where = {
    status: "PUBLISHED" as const,
    ...(searchParams.country ? { countryCode: searchParams.country.toUpperCase() } : {}),
    ...(searchParams.commodity ? { commodity: searchParams.commodity as Commodity } : {}),
    ...(searchParams.site ? { siteType: searchParams.site as SiteExperience } : {}),
    ...(searchParams.fifo === "1" ? { fifo: true } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { roleCategory: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [jobs, total, countries] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
      orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.job.count({ where }),
    prisma.job.groupBy({ by: ["countryCode"], where: { status: "PUBLISHED" }, _count: true }),
  ]);
  // A published job with an unresolved country shouldn't have happened (see
  // src/lib/moderation.ts's jobHasUnresolvedFields gate), but keep the filter
  // dropdown honest regardless — never offer "ZZ" as something to filter by.
  const visibleCountries = countries.filter((c) => !isUnresolvedCountry(c.countryCode));

  const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Find your next role</h1>
      <p className="mt-1 text-sm text-ink/60">{total} live {total === 1 ? "job" : "jobs"}</p>

      {/* Mobile-first filters: stacked selects, GET form so results are shareable */}
      <form className="card mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" method="GET">
        <input name="q" defaultValue={q} placeholder="Keyword" className="field col-span-2 sm:col-span-2" aria-label="Keyword" />
        <select name="country" defaultValue={searchParams.country ?? ""} className="field" aria-label="Country">
          <option value="">All countries</option>
          {visibleCountries.map((c) => <option key={c.countryCode} value={c.countryCode}>{c.countryCode} ({c._count})</option>)}
        </select>
        <select name="commodity" defaultValue={searchParams.commodity ?? ""} className="field" aria-label="Commodity">
          <option value="">All commodities</option>
          {Object.values(Commodity).map((c) => <option key={c} value={c}>{pretty(c)}</option>)}
        </select>
        <select name="site" defaultValue={searchParams.site ?? ""} className="field" aria-label="Site type">
          <option value="">All site types</option>
          {Object.values(SiteExperience).map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
        </select>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" name="fifo" value="1" defaultChecked={searchParams.fifo === "1"} /> FIFO roles only
        </label>
        <button className="btn-dark col-span-2 sm:col-span-1" type="submit">Filter</button>
      </form>

      <div className="mt-4 grid gap-3">
        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        {jobs.length === 0 && (
          <p className="card text-sm text-ink/60">
            No jobs match those filters. Try removing a filter, or save this search from your dashboard to get alerts.
          </p>
        )}
      </div>

      {total > PAGE_SIZE && (
        <nav className="mt-6 flex justify-center gap-2" aria-label="Pagination">
          {page > 1 && <a className="btn-ghost" href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`}>Previous</a>}
          {page * PAGE_SIZE < total && <a className="btn-ghost" href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`}>Next</a>}
        </nav>
      )}
    </div>
  );
}
