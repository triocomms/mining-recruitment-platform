import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { parseFacet, facetWhere, regionSlug } from "@/lib/seo-facets";

export const revalidate = 3600;

async function loadPage(facetParam: string, regionParam: string) {
  const facet = parseFacet(facetParam);
  if (!facet) return null;

  // Resolve the region slug back to the stored region string.
  const regions = await prisma.job.groupBy({
    by: ["region"],
    where: { status: "PUBLISHED", region: { not: null } },
  });
  const region = regions.map((r) => r.region!).find((r) => regionSlug(r) === regionParam);
  if (!region) return null;

  const jobs = await prisma.job.findMany({
    where: { status: "PUBLISHED", region, ...facetWhere(facet) },
    include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
    orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
    take: 50,
  });
  if (jobs.length === 0) return null;
  return { facet, region, jobs };
}

export async function generateMetadata({
  params,
}: {
  params: { facet: string; region: string };
}): Promise<Metadata> {
  const data = await loadPage(params.facet, params.region);
  if (!data) return { title: "Jobs — FiFoDiDo" };
  const title = `${data.facet.label} jobs in ${data.region} — FiFoDiDo`;
  const description = `${data.jobs.length} live ${data.facet.label.toLowerCase()} mining & resources ${
    data.jobs.length === 1 ? "job" : "jobs"
  } in ${data.region}. FIFO, residential and international roles, updated daily.`;
  const canonical = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/jobs/browse/${params.facet}/${params.region}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description },
  };
}

export default async function FacetRegionPage({
  params,
}: {
  params: { facet: string; region: string };
}) {
  const data = await loadPage(params.facet, params.region);
  if (!data) notFound();
  const { facet, region, jobs } = data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="label">
        <Link href="/jobs" className="hover:underline">Jobs</Link> /{" "}
        <Link href="/jobs/browse" className="hover:underline">Browse</Link>
      </p>
      <h1 className="mt-1 font-display text-4xl uppercase tracking-wide">
        {facet.label} jobs in {region}
      </h1>
      <p className="mt-2 max-w-2xl text-ink/70">
        {jobs.length} live {facet.label.toLowerCase()} {jobs.length === 1 ? "role" : "roles"} in{" "}
        {region} right now — from verified mining and resources employers. New ads appear here the
        moment they go live.
      </p>
      <div className="mt-6 grid gap-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </main>
  );
}
