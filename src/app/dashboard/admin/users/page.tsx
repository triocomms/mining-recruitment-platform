import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function tierBadge(u: {
  role: string;
  company: { subscription: { tier: keyof typeof PLANS; status: string } | null } | null;
}) {
  if (u.role === "ADMIN") return { label: "Admin", className: "tag text-hivis" };
  if (u.role === "CANDIDATE") return { label: "Candidate", className: "tag" };
  const sub = u.company?.subscription;
  if (sub && sub.status === "ACTIVE") {
    return { label: PLANS[sub.tier].label, className: sub.tier === "GOLD" ? "tag text-oregold" : "tag" };
  }
  return { label: "No plan", className: "tag text-ink/40" };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const parsedPage = Number(searchParams.page ?? 1);
  const page = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);

  const where = { deletedAt: null } as const;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        suspendedAt: true,
        emailVerifiedAt: true,
        candidate: { select: { id: true } },
        company: { select: { slug: true, subscription: { select: { tier: true, status: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Users</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">{total} user{total === 1 ? "" : "s"} (excluding deleted accounts)</p>

      <ul className="mt-4 space-y-2">
        {users.map((u) => {
          const badge = tierBadge(u);
          const profileHref =
            u.role === "CANDIDATE" && u.candidate
              ? `/dashboard/employer/candidates/${u.candidate.id}`
              : u.role === "EMPLOYER" && u.company
                ? `/companies/${u.company.slug}`
                : null;
          const profileLabel = u.role === "CANDIDATE" ? "View profile" : "View company";

          return (
            <li key={u.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.email}</p>
                <p className="text-xs text-ink/60">
                  {u.role.toLowerCase()} · joined {timeAgo(u.createdAt)}
                  {!u.emailVerifiedAt && <span className="text-oxide"> · unverified</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={badge.className}>{badge.label}</span>
                {u.suspendedAt ? (
                  <span className="tag text-oxide">suspended {timeAgo(u.suspendedAt)}</span>
                ) : (
                  <span className="tag text-patina">active</span>
                )}
                {profileHref && (
                  <Link href={profileHref} className="btn-ghost !px-3 !py-1.5 text-xs">
                    {profileLabel}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
        {users.length === 0 && <p className="card text-sm text-ink/60">No users found.</p>}
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
