import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo, formatLocation, formatSalary } from "@/lib/utils";
import { AdminJobsList, type AdminJobRow } from "@/components/AdminJobsList";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminLiveJobsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const parsedPage = Number(searchParams.page ?? 1);
  const page = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);
  const q = searchParams.q?.trim() ?? "";

  const where = {
    status: "PUBLISHED" as const,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { company: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

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

  const jobRows: AdminJobRow[] = jobs.map((j) => ({
    id: j.id,
    slug: j.slug,
    title: j.title,
    companyName: j.company.name,
    location: formatLocation(j.city, j.region, j.countryCode),
    publishedAgo: j.publishedAt ? timeAgo(j.publishedAt) : null,
    salary: formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Live jobs</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">{total} published job{total === 1 ? "" : "s"}</p>

      <form className="mt-4 flex gap-2" action="/dashboard/admin/jobs">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title or company…"
          className="field flex-1"
        />
        <button type="submit" className="btn-primary text-sm">Search</button>
        {q && (
          <Link href="/dashboard/admin/jobs" className="btn-ghost text-sm">
            Clear
          </Link>
        )}
      </form>

      <AdminJobsList jobs={jobRows} />

      {total > PAGE_SIZE && (
        <nav className="mt-6 flex justify-center gap-2" aria-label="Pagination">
          {page > 1 && (
            <a className="btn-ghost" href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>
              Previous
            </a>
          )}
          {page * PAGE_SIZE < total && (
            <a className="btn-ghost" href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>
              Next
            </a>
          )}
        </nav>
      )}
    </main>
  );
}
