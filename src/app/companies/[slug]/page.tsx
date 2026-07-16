import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { timeAgo } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true },
  });
  if (!company) return { title: "Company not found — Orebridge" };
  return {
    title: `${company.name} — jobs & news on Orebridge`,
    description: company.description?.slice(0, 160) ?? `Open roles at ${company.name}`,
  };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: {
      jobs: {
        where: { status: "PUBLISHED" },
        orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
        include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
      },
      blogPosts: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 6,
      },
      _count: { select: { followers: true } },
    },
  });
  if (!company) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-wide">
            {company.name}
            {company.verificationStatus === "VERIFIED" && (
              <span className="ml-2 align-middle text-xl text-patina" title="Verified employer">✓</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {[company.countryCode, company.size && `${company.size} employees`].filter(Boolean).join(" · ")}
            {company._count.followers > 0 && ` · ${company._count.followers} follower${company._count.followers === 1 ? "" : "s"}`}
          </p>
        </div>
        {company.website && (
          <a href={company.website} target="_blank" rel="noreferrer nofollow" className="btn-ghost">
            Website ↗
          </a>
        )}
      </div>

      {company.description && (
        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-ink/80">{company.description}</p>
      )}

      <div className="strata mt-8" aria-hidden />

      <section className="mt-8">
        <h2 className="font-display text-2xl uppercase tracking-wide">
          Open roles ({company.jobs.length})
        </h2>
        {company.jobs.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No live vacancies right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {company.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      {company.blogPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl uppercase tracking-wide">From {company.name}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.blogPosts.map((p) => (
              <Link key={p.id} href={`/news/${p.slug}`} className="card block">
                <h3 className="font-semibold hover:underline">{p.title}</h3>
                {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-ink/60">{p.excerpt}</p>}
                <p className="mt-2 text-xs text-ink/50">{p.publishedAt ? timeAgo(p.publishedAt) : ""}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
