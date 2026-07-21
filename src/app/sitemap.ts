import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { commodityToSlug, MIN_SALARY_SAMPLE_SIZE } from "@/lib/utils";
import { getFacetRegionCombos } from "@/lib/seo-facets";
import { Commodity } from "@prisma/client";

/**
 * Single combined sitemap. Only ever lists pages that actually resolve with
 * real content — thin/empty dynamic pages (a company with no live jobs, a
 * commodity with too few salaried ads, a facet×region combo with zero jobs)
 * are deliberately left out rather than 404ing or looking empty to Google.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/jobs/browse`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/salaries`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const [jobs, companiesWithJobs, posts, salaryCounts, facetRegionCombos] = await Promise.all([
    prisma.job.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, publishedAt: true },
    }),
    prisma.company.findMany({
      where: { jobs: { some: { status: "PUBLISHED" } } },
      select: { slug: true },
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, publishedAt: true },
    }),
    prisma.job.groupBy({
      by: ["commodity"],
      where: {
        status: "PUBLISHED",
        commodity: { not: null },
        OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
      },
      _count: true,
    }),
    getFacetRegionCombos(),
  ]);

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((j) => ({
    url: `${base}/jobs/${j.slug}`,
    lastModified: j.publishedAt ?? undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const companyRoutes: MetadataRoute.Sitemap = companiesWithJobs.map((c) => ({
    url: `${base}/companies/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const newsRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/news/${p.slug}`,
    lastModified: p.publishedAt ?? undefined,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  // Same MIN_SALARY_SAMPLE_SIZE floor as src/app/salaries/page.tsx — a
  // commodity page that would show "not enough data" isn't worth indexing.
  const salaryRoutes: MetadataRoute.Sitemap = Object.values(Commodity)
    .filter((c) => (salaryCounts.find((s) => s.commodity === c)?._count ?? 0) >= MIN_SALARY_SAMPLE_SIZE)
    .map((c) => ({
      url: `${base}/salaries/${commodityToSlug(c)}`,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

  const browseRoutes: MetadataRoute.Sitemap = facetRegionCombos.map((c) => ({
    url: `${base}/jobs/browse/${c.facetSlug}/${c.regionSlug}`,
    changeFrequency: "daily",
    priority: 0.4,
  }));

  return [...staticRoutes, ...jobRoutes, ...companyRoutes, ...newsRoutes, ...salaryRoutes, ...browseRoutes];
}
