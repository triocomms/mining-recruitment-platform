import Link from "next/link";
import { getFacetRegionCombos } from "@/lib/seo-facets";

export const revalidate = 3600;

export const metadata = {
  title: "Browse mining jobs by commodity, site type & region — FiFoDiDo",
  description:
    "Explore live mining and resources jobs by commodity, site type and region: gold, iron ore, lithium, underground, FIFO and more.",
};

export default async function BrowseIndexPage() {
  const combos = await getFacetRegionCombos();

  const list = combos
    .map((c) => ({
      href: `/jobs/browse/${c.facetSlug}/${c.regionSlug}`,
      label: `${c.facetLabel} jobs in ${c.region}`,
      count: c.count,
    }))
    .sort((a, b) => b.count - a.count);

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
