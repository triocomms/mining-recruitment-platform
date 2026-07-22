import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TAG: Record<string, string> = {
  DRAFT: "bg-bone text-ink/60",
  PUBLISHED: "bg-patina/15 text-patina",
  HIDDEN: "bg-oxide/10 text-oxide",
};

export default async function MyPostsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EMPLOYER")) {
    redirect("/login");
  }

  let posts: {
    id: string;
    title: string;
    excerpt: string | null;
    slug: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
  }[] = [];
  let verificationBlocked = false;

  if (session.user.role === "ADMIN") {
    posts = await prisma.blogPost.findMany({
      where: { type: "EDITORIAL", authorId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, excerpt: true, slug: true, status: true, publishedAt: true, createdAt: true },
    });
  } else {
    const company = await prisma.company.findUnique({ where: { ownerId: session.user.id } });
    if (company) {
      verificationBlocked = company.verificationStatus !== "VERIFIED";
      posts = await prisma.blogPost.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, excerpt: true, slug: true, status: true, publishedAt: true, createdAt: true },
      });
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">My posts</h1>
        <Link href="/dashboard/posts/new" className="btn-primary">Write a new post</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        {session.user.role === "ADMIN"
          ? "Editorial posts you've authored."
          : "Drafts and articles published under your company profile."}
      </p>
      {verificationBlocked && (
        <p className="card mt-4 text-sm text-oxide">
          Your company isn&rsquo;t KYB-verified yet, so posts can be saved as drafts but not published.{" "}
          <Link href="/dashboard/employer" className="underline">Upload your registration document →</Link>
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {posts.map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.title}</p>
              {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{p.excerpt}</p>}
              <p className="mt-1 text-xs text-ink/50">
                {p.status === "PUBLISHED" && p.publishedAt ? `published ${timeAgo(p.publishedAt)}` : `created ${timeAgo(p.createdAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`tag ${STATUS_TAG[p.status] ?? ""}`}>{p.status.toLowerCase()}</span>
              {p.status === "PUBLISHED" && (
                <Link href={`/news/${p.slug}`} className="btn-ghost text-sm">View</Link>
              )}
              <Link href={`/dashboard/posts/${p.id}/edit`} className="btn-ghost text-sm">Edit</Link>
            </div>
          </li>
        ))}
        {posts.length === 0 && (
          <p className="card text-sm text-ink/60">
            No posts yet. <Link href="/dashboard/posts/new" className="underline">Write your first one</Link>.
          </p>
        )}
      </ul>
    </main>
  );
}
