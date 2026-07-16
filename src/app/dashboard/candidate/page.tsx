import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "bg-bone text-ink",
  VIEWED: "bg-bone text-ink",
  SHORTLISTED: "bg-patina/15 text-patina",
  INTERVIEW: "bg-patina/15 text-patina",
  OFFER: "bg-oregold/20 text-ink",
  REJECTED: "bg-oxide/10 text-oxide",
  WITHDRAWN: "bg-bone text-ink/50",
};

export default async function CandidateDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      applications: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { job: { select: { title: true, slug: true, company: { select: { name: true } } } } },
      },
      bookmarks: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { job: { select: { title: true, slug: true, status: true, company: { select: { name: true } } } } },
      },
      followedCompanies: {
        take: 8,
        include: { company: { select: { name: true, slug: true } } },
      },
      threads: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          company: { select: { name: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!profile) redirect("/login");

  const profileGaps: string[] = [];
  if (!profile.resumeKey) profileGaps.push("resume");
  if (!profile.headline) profileGaps.push("headline");
  if (!profile.summary) profileGaps.push("summary");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">
            G&rsquo;day, {profile.firstName}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Profile is{" "}
            <span className={profile.visibility === "PUBLIC" ? "font-semibold text-patina" : "font-semibold"}>
              {profile.visibility === "PUBLIC" ? "visible to verified employers" : "private"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/candidate/profile" className="btn-primary">Edit profile</Link>
          <Link href="/dashboard/messages" className="btn-ghost">Messages</Link>
        </div>
      </div>

      {profileGaps.length > 0 && (
        <div className="mt-4 rounded-md border border-oregold/40 bg-oregold/10 px-4 py-3 text-sm">
          Complete your profile to apply faster — missing: {profileGaps.join(", ")}.{" "}
          <Link href="/dashboard/candidate/profile" className="font-semibold underline">Fix now</Link>
        </div>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="font-display text-xl uppercase tracking-wide">Your applications</h2>
          {profile.applications.length === 0 ? (
            <p className="card mt-3 text-sm text-ink/60">
              No applications yet. <Link href="/jobs" className="underline">Browse open roles</Link>.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.applications.map((a) => (
                <li key={a.id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/jobs/${a.job.slug}`} className="block truncate font-semibold hover:underline">
                      {a.job.title}
                    </Link>
                    <p className="text-xs text-ink/60">{a.job.company.name} · applied {timeAgo(a.createdAt)}</p>
                  </div>
                  <span className={`tag shrink-0 ${STATUS_TONE[a.status] ?? ""}`}>{a.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 font-display text-xl uppercase tracking-wide">Recent messages</h2>
          {profile.threads.length === 0 ? (
            <p className="card mt-3 text-sm text-ink/60">No conversations yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.threads.map((t) => (
                <li key={t.id} className="card">
                  <Link href={`/dashboard/messages/${t.id}`} className="block">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{t.company.name}</span>
                      <span className="text-xs text-ink/50">{timeAgo(t.updatedAt)}</span>
                    </div>
                    {t.messages[0] && (
                      <p className="mt-1 truncate text-sm text-ink/60">{t.messages[0].body}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-8">
          <div>
            <h2 className="font-display text-xl uppercase tracking-wide">Saved jobs</h2>
            {profile.bookmarks.length === 0 ? (
              <p className="card mt-3 text-sm text-ink/60">Nothing saved yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.bookmarks.map((b) => (
                  <li key={b.jobId} className="card text-sm">
                    <Link href={`/jobs/${b.job.slug}`} className="font-semibold hover:underline">
                      {b.job.title}
                    </Link>
                    <p className="text-xs text-ink/60">
                      {b.job.company.name}
                      {b.job.status !== "PUBLISHED" && <span className="text-oxide"> · no longer live</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-display text-xl uppercase tracking-wide">Following</h2>
            {profile.followedCompanies.length === 0 ? (
              <p className="card mt-3 text-sm text-ink/60">You&rsquo;re not following any companies.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.followedCompanies.map((f) => (
                  <li key={f.companyId} className="card text-sm">
                    <Link href={`/companies/${f.company.slug}`} className="font-semibold hover:underline">
                      {f.company.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card border-ink/10 text-sm">
            <p className="font-semibold">Your data, your call</p>
            <p className="mt-1 text-ink/60">Export or delete everything we hold about you.</p>
            <Link href="/dashboard/candidate/privacy" className="mt-2 inline-block underline">
              Privacy controls →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
