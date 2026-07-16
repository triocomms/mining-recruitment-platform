import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const page = Math.max(1, Number(searchParams.page) || 1);
  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { admin: { select: { email: true } } },
    }),
    prisma.adminAuditLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Audit log</h1>
        <Link href="/dashboard/admin" className="text-sm underline">
          ← Admin dashboard
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        {total} entr{total === 1 ? "y" : "ies"} · every privileged admin action is recorded here.
      </p>

      {entries.length === 0 ? (
        <p className="card mt-6 text-sm text-ink/60">No admin actions recorded yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="card text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag">{e.action.replaceAll("_", " ").toLowerCase()}</span>
                <span className="tag bg-ink/5">{e.targetType.toLowerCase()}</span>
                <span className="font-mono text-xs text-ink/50">{e.targetId}</span>
                <span className="ml-auto text-xs text-ink/50">
                  {e.admin.email} · {timeAgo(e.createdAt)}
                </span>
              </div>
              {e.notes && <p className="mt-1 text-xs text-ink/70">{e.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/dashboard/admin/audit?page=${page - 1}`} className="btn-ghost">
              ← Newer
            </Link>
          )}
          <span className="text-ink/60">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`/dashboard/admin/audit?page=${page + 1}`} className="btn-ghost">
              Older →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
