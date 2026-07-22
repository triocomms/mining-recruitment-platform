import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const parsedPage = Number(searchParams.page ?? 1);
  const page = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);

  const where = { status: "ACTIVE" } as const;

  const [subs, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { name: true, slug: true } } },
    }),
    prisma.subscription.count({ where }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Active subscriptions</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">{total} active subscription{total === 1 ? "" : "s"}</p>

      <ul className="mt-4 space-y-2">
        {subs.map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link href={`/companies/${s.company.slug}`} className="block truncate font-semibold hover:underline">
                {s.company.name}
              </Link>
              <p className="text-xs text-ink/60">
                {s.tier.toLowerCase()} · {s.jobsUsedThisPeriod} ads used this period · since {timeAgo(s.createdAt)}
              </p>
            </div>
            <span className="tag">
              {s.currentPeriodEnd
                ? `renews ${s.currentPeriodEnd.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
                : "no renewal date"}
            </span>
          </li>
        ))}
        {subs.length === 0 && <p className="card text-sm text-ink/60">No active subscriptions.</p>}
      </ul>

      {total > PAGE_SIZE && (
        <nav className="mt-6 flex justify-center gap-2" aria-label="Pagination">
          {page > 1 && <a className="btn-ghost" href={`?page=${page - 1}`}>Previous</a>}
          {page * PAGE_SIZE < total && <a className="btn-ghost" href={`?page=${page + 1}`}>Next</a>}
        </nav>
      )}
    </main>
  );
}
