import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export const metadata = {
  title: "Mining industry news & insights — Orebridge",
  description:
    "Hiring trends, site life, and market updates from across the global mining and resources industry.",
};

export const revalidate = 300;

export default async function NewsIndexPage() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ curatedRank: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }],
    take: 30,
    include: { company: { select: { name: true, slug: true } } },
  });

  const [featured, ...rest] = posts;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-4xl uppercase tracking-wide">Industry news</h1>
      <p className="mt-1 text-ink/60">
        Market updates, hiring trends and stories from the people who dig, drill, and process the
        world&rsquo;s resources.
      </p>

      {!featured ? (
        <p className="card mt-8 text-sm text-ink/60">No articles published yet — check back soon.</p>
      ) : (
        <>
          <Link href={`/news/${featured.slug}`} className="card mt-8 block border-l-4 border-l-oregold">
            <p className="label">Featured</p>
            <h2 className="font-display text-2xl uppercase tracking-wide hover:underline">{featured.title}</h2>
            {featured.excerpt && <p className="mt-2 text-ink/70">{featured.excerpt}</p>}
            <p className="mt-2 text-xs text-ink/50">
              {featured.type === "COMPANY" && featured.company ? featured.company.name : "Orebridge Editorial"} ·{" "}
              {featured.publishedAt ? timeAgo(featured.publishedAt) : ""}
            </p>
          </Link>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <Link key={p.id} href={`/news/${p.slug}`} className="card block">
                <h3 className="font-semibold hover:underline">{p.title}</h3>
                {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-ink/60">{p.excerpt}</p>}
                <p className="mt-2 text-xs text-ink/50">
                  {p.type === "COMPANY" && p.company ? p.company.name : "Orebridge Editorial"} ·{" "}
                  {p.publishedAt ? timeAgo(p.publishedAt) : ""}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
