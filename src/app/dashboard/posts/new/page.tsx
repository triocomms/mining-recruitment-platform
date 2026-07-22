import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BlogComposer } from "@/components/BlogComposer";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EMPLOYER")) {
    redirect("/login");
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">New post</h1>
        <Link href="/dashboard/posts" className="text-sm underline">← My posts</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        {session.user.role === "ADMIN"
          ? "Published as Orebridge Editorial."
          : "Published under your company profile (verification required to publish)."}
      </p>
      <div className="mt-6">
        <BlogComposer />
      </div>
    </main>
  );
}
