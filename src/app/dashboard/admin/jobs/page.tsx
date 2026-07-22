import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo, formatLocation, formatSalary } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminLiveJobsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const parsedPage = Number(searchParams.page ?? 1);
  const page = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);

  const where = { status: "PUBLISHED" } as const;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { name: true, slug: true } } },
    }),
    prisma.job.count({ where }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Live jobs</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">{total} published job{total === 1 ? "" : "s"}</p>

      <ul className="mt-4 space-y-2">
        {jobs.map((j) => (
          <li key={j.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link href={`/jobs/${j.slug}`} className="block truncate font-semibold hover:underline">
                {j.title}
              </Link>
              <p className="text-xs text-ink/60">
                {j.company.name} · {formatLocation(j.city, j.region, j.countryCode)}
                {j.publishedAt && <> · published {timeAgo(j.publishedAt)}</>}
              </p>
            </div>
            <span className="tag">{formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod) ?? "No salary listed"}</span>
          </li>
        ))}
        {jobs.length === 0 && <p className="card text-sm text-ink/60">No live jobs.</p>}
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
