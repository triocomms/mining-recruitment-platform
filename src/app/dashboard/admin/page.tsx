import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo, isUnresolvedCountry } from "@/lib/utils";
import { AdminVerifyActions, AdminCredentialActions, AdminCurateActions, AdminJobReviewQueue, AdminSuspendForm, AdminUnsuspendButton, AdminReportActions, AdminRefundButton } from "@/components/AdminActions";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [pendingCompanies, pendingCertifications, pendingEmploymentHistory, pendingJobs, openReports, posts, suspendedUsers, overagePurchases, activeSubscriptions, cronRuns, stats] = await Promise.all([
    prisma.company.findMany({
      where: { verificationStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { owner: { select: { email: true } } },
    }),
    prisma.certification.findMany({
      where: { verificationStatus: "PENDING" },
      orderBy: { id: "asc" },
      include: { candidate: { select: { firstName: true, lastName: true } } },
    }),
    prisma.employmentHistory.findMany({
      where: { verificationStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { candidate: { select: { firstName: true, lastName: true } } },
    }),
    prisma.job.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      include: { company: { select: { name: true, verificationStatus: true } } },
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
    prisma.user.findMany({
      where: { suspendedAt: { not: null } },
      orderBy: { suspendedAt: "desc" },
      select: { id: true, email: true, role: true, suspendedAt: true, suspendedReason: true },
    }),
    prisma.overagePurchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { company: { select: { name: true } } },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { company: { select: { name: true } } },
    }),
    prisma.cronRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 9,
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
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Admin</h1>
        <nav className="flex gap-4 text-sm">
          <a href="/dashboard/admin/analytics" className="underline">Analytics</a>
          <a href="/dashboard/admin/emails" className="underline">Email</a>
          <a href="/dashboard/admin/audit" className="underline">Audit log</a>
        </nav>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Users", users, "/dashboard/admin/users"],
          ["Live jobs", liveJobs, "/dashboard/admin/jobs"],
          ["Applications", applications, "/dashboard/admin/applications"],
          ["Active subs", activeSubs, "/dashboard/admin/subscriptions"],
        ].map(([label, value, href]) => (
          <Link key={label as string} href={href as string} className="card block text-center hover:shadow-md">
            <p className="font-display text-3xl">{value as number}</p>
            <p className="label">{label}</p>
          </Link>
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
          Certification verification queue ({pendingCertifications.length})
        </h2>
        {pendingCertifications.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">Queue is clear.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingCertifications.map((c) => (
              <li key={c.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-ink/60">
                      {c.candidate.firstName} {c.candidate.lastName}
                      {c.issuer ? ` · ${c.issuer}` : ""}
                      {c.referenceNo ? ` · ref ${c.referenceNo}` : ""}
                    </p>
                    {c.documentKey ? (
                      <a
                        href={`/api/files?key=${encodeURIComponent(c.documentKey)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm underline"
                      >
                        View scan →
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-oxide">No document attached</p>
                    )}
                  </div>
                  <AdminCredentialActions kind="CERTIFICATION" id={c.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">
          Employment history verification queue ({pendingEmploymentHistory.length})
        </h2>
        {pendingEmploymentHistory.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">Queue is clear.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingEmploymentHistory.map((e) => (
              <li key={e.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{e.title} — {e.companyName}</p>
                    <p className="text-xs text-ink/60">
                      {e.candidate.firstName} {e.candidate.lastName} ·{" "}
                      {e.startDate.toISOString().slice(0, 10)} –{" "}
                      {e.endDate ? e.endDate.toISOString().slice(0, 10) : "present"}
                    </p>
                    {e.documentKey ? (
                      <a
                        href={`/api/files?key=${encodeURIComponent(e.documentKey)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm underline"
                      >
                        View proof →
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-oxide">No document attached</p>
                    )}
                  </div>
                  <AdminCredentialActions kind="EMPLOYMENT_HISTORY" id={e.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">
          Job ad review queue ({pendingJobs.length})
        </h2>
        <AdminJobReviewQueue
          jobs={pendingJobs.map((j) => ({
            id: j.id,
            title: j.title,
            companyName: j.company.name,
            companyVerification: j.company.verificationStatus,
            countryCode: j.countryCode,
            region: j.region,
            moderationFlags: j.moderationFlags,
            description: j.description,
            submittedAgo: timeAgo(j.createdAt),
            unresolvedCountry: isUnresolvedCountry(j.countryCode),
          }))}
        />
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
                <AdminReportActions reportId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">
          User moderation
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label mb-2">Suspend a user (blocks sign-in, keeps data)</p>
            <AdminSuspendForm />
          </div>
          <div>
            <p className="label mb-2">Suspended users ({suspendedUsers.length})</p>
            {suspendedUsers.length === 0 ? (
              <p className="card text-sm text-ink/60">Nobody is suspended.</p>
            ) : (
              <ul className="space-y-2">
                {suspendedUsers.map((u) => (
                  <li key={u.id} className="card flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{u.email}</p>
                      <p className="text-xs text-ink/60">
                        {u.role.toLowerCase()} · suspended {timeAgo(u.suspendedAt!)} · {u.suspendedReason}
                      </p>
                    </div>
                    <AdminUnsuspendButton userId={u.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">Billing & refunds</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="label mb-2">Recent overage purchases</p>
            {overagePurchases.length === 0 ? (
              <p className="card text-sm text-ink/60">No overage purchases.</p>
            ) : (
              <ul className="space-y-2">
                {overagePurchases.map((o) => (
                  <li key={o.id} className="card flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{o.company.name}</p>
                      <p className="text-xs text-ink/60">
                        {(o.amountCents / 100).toLocaleString("en", { style: "currency", currency: o.currency.toUpperCase() })}
                        {" · "}{o.consumed ? "consumed" : "unspent"} · {timeAgo(o.createdAt)}
                        {o.refundedAt && <span className="text-oxide"> · refunded</span>}
                      </p>
                    </div>
                    {!o.refundedAt && <AdminRefundButton kind="OVERAGE" targetId={o.id} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="label mb-2">Active subscriptions</p>
            {activeSubscriptions.length === 0 ? (
              <p className="card text-sm text-ink/60">No active subscriptions.</p>
            ) : (
              <ul className="space-y-2">
                {activeSubscriptions.map((s) => (
                  <li key={s.id} className="card flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.company.name}</p>
                      <p className="text-xs text-ink/60">
                        {s.tier.toLowerCase()} · {s.jobsUsedThisPeriod} ads used this period
                      </p>
                    </div>
                    <AdminRefundButton kind="SUBSCRIPTION" targetId={s.id} label="Refund last payment" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">Scheduled jobs</h2>
        <p className="mt-1 text-xs text-ink/50">
          Nightly cron: job-ad expiry, GDPR purge, analytics rollup. Most recent runs below —
          silence longer than a day means the cron is failing to fire.
        </p>
        {cronRuns.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">
            No runs recorded yet. The cron fires daily at 18:00 UTC (or hit /api/cron/daily manually).
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {cronRuns.map((r) => (
              <li key={r.id} className="card text-sm">
                <p className="font-semibold">{r.job}</p>
                <p className="text-xs">
                  {r.ok === null ? (
                    <span className="text-ink/50">running…</span>
                  ) : r.ok ? (
                    <span className="text-patina">ok</span>
                  ) : (
                    <span className="text-oxide">failed</span>
                  )}
                  {" · "}{timeAgo(r.startedAt)}
                </p>
                {r.detail && <p className="mt-1 truncate text-xs text-ink/60">{r.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl uppercase tracking-wide">News & blog curation</h2>
          <div className="flex gap-3 text-sm">
            <a href="/dashboard/posts/new" className="underline">Write a post</a>
            <a href="/dashboard/posts" className="underline">My posts</a>
          </div>
        </div>
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
