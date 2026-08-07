import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JobCard } from "@/components/JobCard";
import { SaveSearchButton } from "@/components/SaveSearchButton";
import { Typeahead } from "@/components/Typeahead";
import { isUnresolvedCountry } from "@/lib/utils";
import { Commodity, SiteExperience, Prisma } from "@prisma/client";
import { getLocale, getDictionary } from "@/lib/i18n";

export const metadata = { title: "Browse mining & resources jobs" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    country?: string;
    commodity?: string;
    site?: string;
    fifo?: string;
    minSalary?: string;
    maxSalary?: string;
    loc?: string;
    page?: string;
  };
}) {
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.jobsFilter;
  const parsedPage = Number(searchParams.page ?? 1);
  const page = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);
  const q = searchParams.q?.trim();
  const loc = searchParams.loc?.trim();

  // Build Previous/Next hrefs from only the params actually present — passing
  // searchParams straight into URLSearchParams stringifies missing keys as
  // the literal text "undefined" (e.g. "...&country=undefined&...").
  function hrefForPage(p: number) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.loc) params.set("loc", searchParams.loc);
    if (searchParams.country) params.set("country", searchParams.country);
    if (searchParams.commodity) params.set("commodity", searchParams.commodity);
    if (searchParams.site) params.set("site", searchParams.site);
    if (searchParams.fifo) params.set("fifo", searchParams.fifo);
    if (searchParams.minSalary) params.set("minSalary", searchParams.minSalary);
    if (searchParams.maxSalary) params.set("maxSalary", searchParams.maxSalary);
    params.set("page", String(p));
    return `?${params}`;
  }

  // Salary is stored as a min/max range per job (plus currency/period), not a
  // single figure — so "at least $X" means the job's own upper bound (or its
  // single value, if only one of min/max was set) clears $X, and "at most $Y"
  // means the job's lower bound clears under $Y. Jobs with no salary data at
  // all are excluded from a salary-filtered search rather than guessed at.
  // Deliberately not converting across currencies/pay periods — that needs
  // FX/normalization data this repo doesn't have; the UI says so.
  const minSalary = searchParams.minSalary ? Number(searchParams.minSalary) : undefined;
  const maxSalary = searchParams.maxSalary ? Number(searchParams.maxSalary) : undefined;
  const salaryConditions: Prisma.JobWhereInput[] = [];
  if (minSalary !== undefined && Number.isFinite(minSalary)) {
    salaryConditions.push({
      OR: [{ salaryMax: { gte: minSalary } }, { salaryMax: null, salaryMin: { gte: minSalary } }],
    });
  }
  if (maxSalary !== undefined && Number.isFinite(maxSalary)) {
    salaryConditions.push({
      OR: [{ salaryMin: { lte: maxSalary } }, { salaryMin: null, salaryMax: { lte: maxSalary } }],
    });
  }

  // q and loc each need their own OR group, plus the salary OR groups above —
  // a plain object can only have one "OR" key, so all of them are folded
  // into a single AND array instead of spread in individually.
  const andConditions: Prisma.JobWhereInput[] = [...salaryConditions];
  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
        { roleCategory: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  if (loc) {
    andConditions.push({
      OR: [
        { city: { contains: loc, mode: "insensitive" as const } },
        { region: { contains: loc, mode: "insensitive" as const } },
        { countryCode: { contains: loc, mode: "insensitive" as const } },
      ],
    });
  }

  const where: Prisma.JobWhereInput = {
    status: "PUBLISHED",
    ...(searchParams.country ? { countryCode: searchParams.country.toUpperCase() } : {}),
    ...(searchParams.commodity ? { commodity: searchParams.commodity as Commodity } : {}),
    ...(searchParams.site ? { siteType: searchParams.site as SiteExperience } : {}),
    ...(searchParams.fifo === "1" ? { fifo: true } : {}),
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };

  const session = await auth();

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

  // Fallback for any enum value the dictionary doesn't (yet) cover -- keeps
  // the filter usable in every language even if a future enum member is
  // added to schema.prisma before its translation is.
  const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const commodityLabel = (c: string) => dict.enums.commodity[c] ?? pretty(c);
  const siteLabel = (s: string) => dict.enums.siteExperience[s] ?? pretty(s);

  return (
    <div>
      <span className="rule-oxide mb-2" />
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">{t.heading}</h1>
      <p className="mt-1 text-sm text-ink/60">{t.liveJobs(total)}</p>

      {/* Mobile-first filters: stacked selects, GET form so results are shareable */}
      <form className="card mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6" method="GET">
        <Typeahead
          name="q"
          type="title"
          defaultValue={q}
          placeholder={t.jobTitlePlaceholder}
          className="field col-span-2 sm:col-span-2"
          ariaLabel="Job title"
        />
        <Typeahead
          name="loc"
          type="location"
          defaultValue={loc}
          placeholder={t.locationPlaceholder}
          className="field col-span-2 sm:col-span-2"
          ariaLabel={t.locationAriaLabel}
        />
        <select name="country" defaultValue={searchParams.country ?? ""} className="field col-span-1" aria-label={t.countryAriaLabel}>
          <option value="">{t.allCountries}</option>
          {visibleCountries.map((c) => <option key={c.countryCode} value={c.countryCode}>{c.countryCode} ({c._count})</option>)}
        </select>
        <select name="commodity" defaultValue={searchParams.commodity ?? ""} className="field col-span-1" aria-label={t.commodityAriaLabel}>
          <option value="">{t.allCommodities}</option>
          {Object.values(Commodity).map((c) => <option key={c} value={c}>{commodityLabel(c)}</option>)}
        </select>
        <select name="site" defaultValue={searchParams.site ?? ""} className="field col-span-2 sm:col-span-2" aria-label={t.siteAriaLabel}>
          <option value="">{t.allSiteTypes}</option>
          {Object.values(SiteExperience).map((s) => <option key={s} value={s}>{siteLabel(s)}</option>)}
        </select>
        <input
          type="number"
          name="minSalary"
          min={0}
          defaultValue={searchParams.minSalary ?? ""}
          placeholder={t.minSalaryPlaceholder}
          className="field col-span-1 sm:col-span-2"
          aria-label={t.minSalaryAriaLabel}
        />
        <input
          type="number"
          name="maxSalary"
          min={0}
          defaultValue={searchParams.maxSalary ?? ""}
          placeholder={t.maxSalaryPlaceholder}
          className="field col-span-1 sm:col-span-2"
          aria-label={t.maxSalaryAriaLabel}
        />
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="fifo" value="1" defaultChecked={searchParams.fifo === "1"} /> {t.fifoOnly}
        </label>
        <button className="btn-dark col-span-2 sm:col-span-3" type="submit">{t.filterButton}</button>
        <p className="col-span-2 text-xs text-ink/50 sm:col-span-6">
          {t.salaryDisclaimer}
        </p>
      </form>

      <SaveSearchButton
        signedIn={session?.user.role === "CANDIDATE"}
        filters={{
          commodity: searchParams.commodity,
          site: searchParams.site,
          country: searchParams.country,
          fifo: searchParams.fifo,
          minSalary: searchParams.minSalary,
        }}
      />

      <div className="mt-4 grid gap-3">
        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        {jobs.length === 0 && (
          <p className="card text-sm text-ink/60">
            {t.noJobsMatch}
          </p>
        )}
      </div>

      {total > PAGE_SIZE && (
        <nav className="mt-6 flex justify-center gap-2" aria-label={t.paginationAriaLabel}>
          {page > 1 && <a className="btn-ghost" href={hrefForPage(page - 1)}>{t.previous}</a>}
          {page * PAGE_SIZE < total && <a className="btn-ghost" href={hrefForPage(page + 1)}>{t.next}</a>}
        </nav>
      )}
    </div>
  );
}
