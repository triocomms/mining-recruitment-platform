import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { HomeWorldMap } from "@/components/HomeWorldMap";
import { FeaturedEmployerAd } from "@/components/FeaturedEmployerAd";
import { FEATURES } from "@/lib/feature-flags";
import { pickDiverseJobs } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";

function organizationJsonLd() {
  return {
    "@context": "https://schema.org/",
    "@type": "Organization",
    name: "FiFoDiDo",
    url: "https://www.fifodido.com",
    logo: "https://www.fifodido.com/fifodido-logo.svg",
    description:
      "The global job board for mining and resources. FIFO, residential and international roles across gold, iron ore, lithium, copper and more.",
  };
}

function websiteJsonLd() {
  return {
    "@context": "https://schema.org/",
    "@type": "WebSite",
    name: "FiFoDiDo",
    url: "https://www.fifodido.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.fifodido.com/jobs?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
}

// Reading the candidate's language cookie (via getLocale() below) opts this
// page into dynamic, per-request rendering, so the old 5-minute ISR window
// no longer applies -- there's no static build to revalidate once the page
// has to know which language cookie the requester sent.
const LATEST_ROLES_COUNT = 6;
// Bulk RSS imports publish dozens of jobs from one company within seconds
// of each other, so pulling straight from a "latest N" query can leave the
// homepage showing the same employer 6 times in a row. Fetching a wider
// pool and capping how many come from any one company keeps this section
// feeling like a cross-section of the site rather than one company's feed.
const LATEST_ROLES_POOL_SIZE = 300;
const MAX_PER_COMPANY = 2;

export default async function HomePage() {
  const locale = getLocale();
  const dict = getDictionary(locale).home;
  const [jobPool, news, jobCount, countryCounts] = await Promise.all([
    prisma.job.findMany({
      where: { status: "PUBLISHED" },
      include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
      orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
      take: LATEST_ROLES_POOL_SIZE,
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ curatedRank: "asc" }, { publishedAt: "desc" }],
      take: 3,
      include: { company: { select: { name: true } } },
    }),
    prisma.job.count({ where: { status: "PUBLISHED" } }),
    prisma.job.groupBy({ by: ["countryCode"], where: { status: "PUBLISHED" }, _count: true }),
  ]);

  const jobs = pickDiverseJobs(jobPool, LATEST_ROLES_COUNT, MAX_PER_COMPANY);

  const jobsByCountry = Object.fromEntries(
    countryCounts.map((c) => [c.countryCode, c._count])
  );

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }} />
      <section className="flex items-start justify-between gap-8 pt-6 sm:pt-10">
        <div className="min-w-0">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-oxide">
          {dict.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {dict.headlineLine1}
          <br />
          {dict.headlineTo}<span className="text-oxide">{dict.headlinePlant}</span>
        </h1>
        <p className="mt-4 max-w-xl text-ink/70">
          {dict.introRoles(jobCount)} {dict.introRest}
        </p>
        <form action="/jobs" className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input name="q" className="field flex-1" placeholder={dict.searchPlaceholder} aria-label="Search jobs" />
          <button className="btn-primary" type="submit">{dict.searchButton}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {/* The query value (?q=...) always stays in English -- job postings
              are English text, so translating the search term would silently
              return zero results. Only the visible chip label is localized. */}
          {["FIFO", "Underground", "Drill & Blast", "Fixed Plant", "Geology", "Haul Truck"].map((t) => (
            <Link key={t} href={`/jobs?q=${encodeURIComponent(t)}`} className="tag hover:bg-ink/10">{dict.quickFilters[t]}</Link>
          ))}
        </div>
        </div>

        {FEATURES.featuredEmployerAd && <FeaturedEmployerAd />}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <span className="rule-oxide mb-2" />
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">{dict.latestRolesHeading}</h2>
          </div>
          <Link href="/jobs" className="text-sm font-semibold text-oxide hover:underline">{dict.allJobsLink}</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          {jobs.length === 0 && (
            <p className="card text-sm text-ink/60">{dict.noJobsPre}<Link className="underline" href="/register">{dict.noJobsLink}</Link>{dict.noJobsPost}</p>
          )}
        </div>
      </section>

      <HomeWorldMap counts={jobsByCountry} />

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <span className="rule-oxide mb-2" />
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">{dict.industryNewsHeading}</h2>
          </div>
          <Link href="/news" className="text-sm font-semibold text-oxide hover:underline">{dict.allNewsLink}</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {news.map((post) => (
            <Link key={post.id} href={`/news/${post.slug}`} className="card block hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wide text-oxide">
                {post.type === "EDITORIAL" ? dict.editorialLabel : post.company?.name}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{post.title}</h3>
              {post.excerpt && <p className="mt-2 text-sm text-ink/60">{post.excerpt}</p>}
            </Link>
          ))}
          {news.length === 0 && <p className="card text-sm text-ink/60 sm:col-span-3">{dict.newsComingSoon}</p>}
        </div>
      </section>
    </div>
  );
}
