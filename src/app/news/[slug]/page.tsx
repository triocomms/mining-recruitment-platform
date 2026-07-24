import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
    select: { title: true, excerpt: true, status: true },
  });
  if (!post || post.status !== "PUBLISHED") return { title: "Article not found — FiFoDiDo" };
  return {
    title: `${post.title} — FiFoDiDo`,
    description: post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined, type: "article" },
  };
}

export default async function NewsArticlePage({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
    include: {
      company: { select: { name: true, slug: true, verificationStatus: true } },
      images: { orderBy: { order: "asc" } },
    },
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
            "FiFoDiDo Editorial"
          )}
          {post.publishedAt && ` · ${post.publishedAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase leading-tight tracking-wide">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-lg text-ink/70">{post.excerpt}</p>}
        {post.coverKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files?key=${encodeURIComponent(post.coverKey)}`}
            alt={post.coverAlt ?? ""}
            className="mt-6 aspect-[2/1] w-full rounded-xl object-cover"
          />
        )}
        <div className="strata mt-6" aria-hidden />
        <div
          className="mt-6 max-w-none text-ink/90"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />
        {post.images.length > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {post.images.map((img) => (
              <figure key={img.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files?key=${encodeURIComponent(img.key)}`}
                  alt={img.altText}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
                <figcaption className="mt-1 text-xs text-ink/50">{img.altText}</figcaption>
              </figure>
            ))}
          </div>
        )}
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
