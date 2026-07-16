import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
    select: { title: true, excerpt: true, status: true },
  });
  if (!post || post.status !== "PUBLISHED") return { title: "Article not found — Orebridge" };
  return {
    title: `${post.title} — Orebridge`,
    description: post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined, type: "article" },
  };
}

export default async function NewsArticlePage({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
    include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
  });
  if (!post || post.status !== "PUBLISHED") notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <article>
        <p className="label">
          {post.type === "COMPANY" && post.company ? (
            <Link href={`/companies/${post.company.slug}`} className="hover:underline">
              {post.company.name}
              {post.company.verificationStatus === "VERIFIED" && " ✓"}
            </Link>
          ) : (
            "Orebridge Editorial"
          )}
          {post.publishedAt && ` · ${post.publishedAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase leading-tight tracking-wide">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-lg text-ink/70">{post.excerpt}</p>}
        <div className="strata mt-6" aria-hidden />
        <div className="mt-6 max-w-none whitespace-pre-wrap leading-relaxed text-ink/90">{post.body}</div>
      </article>

      <div className="mt-10 flex items-center justify-between border-t border-ink/10 pt-4 text-sm">
        <Link href="/news" className="underline">← All news</Link>
        {post.type === "COMPANY" && post.company && (
          <Link href={`/companies/${post.company.slug}`} className="underline">
            Jobs at {post.company.name} →
          </Link>
        )}
      </div>
    </main>
  );
}
