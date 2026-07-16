import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { AdminVerifyActions, AdminCurateActions } from "@/components/AdminActions";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [pendingCompanies, openReports, posts, stats] = await Promise.all([
    prisma.company.findMany({
      where: { verificationStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { owner: { select: { email: true } } },
    }),
    prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { reporter: { select: { email: true } } },
    }),
    prisma.blogPost.findMany({
      where: { status: { in: ["PUBLISHED", "HIDDEN"] } },
      orderBy: [{ curatedRank: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }],
      take: 30,
      include: { company: { select: { name: true } }, author: { select: { email: true } } },
    }),
    Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.job.count({ where: { status: "PUBLISHED" } }),
      prisma.application.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
    ]),
  ]);

  const [users, liveJobs, applications, activeSubs] = stats;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Admin</h1>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Users", users],
          ["Live jobs", liveJobs],
          ["Applications", applications],
          ["Active subs", activeSubs],
        ].map(([label, value]) => (
          <div key={label as string} className="card text-center">
            <p className="font-display text-3xl">{value as number}</p>
            <p className="label">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">
          KYB verification queue ({pendingCompanies.length})
        </h2>
        {pendingCompanies.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">Queue is clear.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingCompanies.map((c) => (
              <li key={c.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-ink/60">
                      {c.owner.email} · {c.countryCode ?? "country unknown"} · submitted {timeAgo(c.createdAt)}
                    </p>
                    {c.kybDocumentKey ? (
                      <a
                        href={`/api/files?key=${encodeURIComponent(c.kybDocumentKey)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm underline"
                      >
                        View registration document →
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-oxide">No document attached</p>
                    )}
                  </div>
                  <AdminVerifyActions companyId={c.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">
          Open reports ({openReports.length})
        </h2>
        {openReports.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No open reports.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openReports.map((r) => (
              <li key={r.id} className="card text-sm">
                <p>
                  <span className="tag">{r.targetType.toLowerCase()}</span>{" "}
                  <span className="font-mono text-xs text-ink/50">{r.targetId}</span>
                </p>
                <p className="mt-1">{r.reason}</p>
                <p className="mt-1 text-xs text-ink/50">by {r.reporter?.email ?? "anonymous"} · {timeAgo(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">News & blog curation</h2>
        <p className="mt-1 text-xs text-ink/50">
          Set a rank (0 = top) to feature a post on the homepage; clear it to unfeature; hide removes it from the site.
        </p>
        {posts.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No published posts.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="text-xs text-ink/60">
                    {p.type === "COMPANY" ? p.company?.name : `Editorial · ${p.author?.email}`}
                    {p.status === "HIDDEN" && <span className="text-oxide"> · hidden</span>}
                    {p.curatedRank != null && <span className="text-patina"> · featured #{p.curatedRank}</span>}
                  </p>
                </div>
                <AdminCurateActions postId={p.id} curatedRank={p.curatedRank} hidden={p.status === "HIDDEN"} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
