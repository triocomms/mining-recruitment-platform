import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { HomeWorldMap } from "@/components/HomeWorldMap";
import { FeaturedEmployerAd } from "@/components/FeaturedEmployerAd";

export const revalidate = 300;

export default async function HomePage() {
  const [jobs, news, jobCount, countryCounts] = await Promise.all([
    prisma.job.findMany({
      where: { status: "PUBLISHED" },
      include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
      orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
      take: 6,
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

  const jobsByCountry = Object.fromEntries(
    countryCounts.map((c) => [c.countryCode, c._count])
  );

  return (
    <div className="space-y-12">
      <section className="flex items-start justify-between gap-8 pt-6 sm:pt-10">
        <div className="min-w-0">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-oxide">
          Mining · Resources · Energy
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
          From the pit
          <br />
          to the plant.
        </h1>
        <p className="mt-4 max-w-xl text-ink/70">
          {jobCount > 0 ? `${jobCount} open roles` : "Open roles"} across gold, iron ore, lithium, copper and
          more — FIFO, residential and international. Built for the people who dig, drill, process and haul.
        </p>
        <form action="/jobs" className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input name="q" className="field flex-1" placeholder="Job title, ticket, or keyword" aria-label="Search jobs" />
          <button className="btn-primary" type="submit">Search jobs</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {["FIFO", "Underground", "Drill & Blast", "Fixed Plant", "Geology", "Haul Truck"].map((t) => (
            <Link key={t} href={`/jobs?q=${encodeURIComponent(t)}`} className="tag hover:bg-ink/10">{t}</Link>
          ))}
        </div>
        </div>

        <FeaturedEmployerAd />
      </section>

      <HomeWorldMap counts={jobsByCountry} />

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Latest roles</h2>
          <Link href="/jobs" className="text-sm font-semibold text-oxide hover:underline">All jobs →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          {jobs.length === 0 && (
            <p className="card text-sm text-ink/60">No live jobs yet. Employers can <Link className="underline" href="/register">post the first one free</Link>.</p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Industry news</h2>
          <Link href="/news" className="text-sm font-semibold text-oxide hover:underline">All news →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {news.map((post) => (
            <Link key={post.id} href={`/news/${post.slug}`} className="card block hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wide text-oxide">
                {post.type === "EDITORIAL" ? "Editorial" : post.company?.name}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{post.title}</h3>
              {post.excerpt && <p className="mt-2 text-sm text-ink/60">{post.excerpt}</p>}
            </Link>
          ))}
          {news.length === 0 && <p className="card text-sm text-ink/60 sm:col-span-3">News hub launches with our first employer partners.</p>}
        </div>
      </section>
    </div>
  );
}
