import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BlogComposer } from "@/components/BlogComposer";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EMPLOYER")) {
    redirect("/login");
  }

  const post = await prisma.blogPost.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { order: "asc" } }, company: { select: { ownerId: true } } },
  });
  if (!post) notFound();

  // Same ownership rule as the PATCH/DELETE API: employers only ever touch
  // their own company's posts; admins collectively own every EDITORIAL post.
  const authorized =
    session.user.role === "ADMIN"
      ? post.type === "EDITORIAL"
      : post.type === "COMPANY" && post.company?.ownerId === session.user.id;
  if (!authorized) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Edit post</h1>
        <Link href="/dashboard/posts" className="text-sm underline">← My posts</Link>
      </div>
      <div className="mt-6">
        <BlogComposer
          post={{
            id: post.id,
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            coverKey: post.coverKey,
            coverAlt: post.coverAlt,
            gallery: post.images.map((i) => ({ key: i.key, altText: i.altText })),
          }}
        />
      </div>
    </main>
  );
}
