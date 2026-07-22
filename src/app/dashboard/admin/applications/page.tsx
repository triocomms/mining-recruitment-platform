import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const parsedPage = Number(searchParams.page ?? 1);
  const page = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        job: { select: { title: true, slug: true, company: { select: { name: true } } } },
        candidate: { select: { user: { select: { email: true } } } },
      },
    }),
    prisma.application.count(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Applications</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">{total} application{total === 1 ? "" : "s"} (all time)</p>

      <ul className="mt-4 space-y-2">
        {applications.map((a) => (
          <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link href={`/jobs/${a.job.slug}`} className="block truncate font-semibold hover:underline">
                {a.job.title}
              </Link>
              <p className="text-xs text-ink/60">
                {a.job.company.name} · {a.candidate.user.email} · applied {timeAgo(a.createdAt)}
              </p>
            </div>
            <span className="tag">{pretty(a.status)}</span>
          </li>
        ))}
        {applications.length === 0 && <p className="card text-sm text-ink/60">No applications yet.</p>}
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
