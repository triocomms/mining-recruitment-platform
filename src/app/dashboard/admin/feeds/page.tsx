import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminFeedManager } from "@/components/AdminFeedManager";

export const dynamic = "force-dynamic";

export default async function AdminFeedsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const feeds = await prisma.jobFeed.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: { select: { id: true, name: true, slug: true, verificationStatus: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">RSS feeds</h1>
        <a href="/dashboard/admin" className="text-sm underline">← Admin dashboard</a>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Seed the site with real listings by syndicating a company&apos;s public careers feed. Imported jobs
        keep their own apply link — candidates who click Apply are sent straight to the company&apos;s site,
        not FiFoDiDo&apos;s own application flow.
      </p>
      <div className="mt-6">
        <AdminFeedManager initialFeeds={feeds as any} />
      </div>
    </main>
  );
}
