import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { facetSlug, regionSlug } from "@/lib/seo-facets";

export const revalidate = 3600;

export const metadata = {
  title: "Browse mining jobs by commodity, site type & region — Orebridge",
  description:
    "Explore live mining and resources jobs by commodity, site type and region: gold, iron ore, lithium, underground, FIFO and more.",
};

export default async function BrowseIndexPage() {
  const jobs = await prisma.job.findMany({
    where: { status: "PUBLISHED", region: { not: null } },
    select: { commodity: true, siteType: true, fifo: true, region: true },
  });

  const combos = new Map<string, { label: string; href: string; count: number }>();
  const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const add = (facet: string, label: string, region: string) => {
    const href = `/jobs/browse/${facet}/${regionSlug(region)}`;
    const cur = combos.get(href);
    if (cur) cur.count++;
    else combos.set(href, { label: `${label} jobs in ${region}`, href, count: 1 });
  };

  for (const j of jobs) {
    if (!j.region) continue;
    if (j.commodity) add(facetSlug(j.commodity), pretty(j.commodity), j.region);
    if (j.siteType) add(facetSlug(j.siteType), pretty(j.siteType), j.region);
    if (j.fifo) add("fifo", "FIFO", j.region);
  }

  const list = Array.from(combos.values()).sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-4xl uppercase tracking-wide">Browse jobs</h1>
      <p className="mt-1 text-ink/60">Live roles by commodity, site type and region.</p>
      {list.length === 0 ? (
        <p className="card mt-6 text-sm text-ink/60">No live jobs yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="card block text-sm hover:underline">
                {c.label} <span className="text-ink/40">({c.count})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
