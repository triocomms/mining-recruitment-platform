import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { scoreMatch } from "@/lib/matching";
import { JobCard } from "@/components/JobCard";
import { DeleteSavedSearchButton } from "@/components/DeleteSavedSearchButton";
import { SavedSearchFrequencyToggle } from "@/components/SavedSearchFrequencyToggle";
import { PromoteMeCard } from "@/components/PromoteMeCard";
import type { Prisma } from "@prisma/client";

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
      certifications: { select: { name: true, expiresAt: true } },
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
      savedSearches: { orderBy: { createdAt: "desc" } },
      promotions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!profile) redirect("/login");

  const profileGaps: string[] = [];
  if (!profile.resumeKey) profileGaps.push("resume");
  if (!profile.headline) profileGaps.push("headline");
  if (!profile.summary) profileGaps.push("summary");

  // "Jobs matching you" -- reuses the same scoreMatch() the employer side
  // uses to rank candidates against a job (src/lib/matching.ts), just run
  // in the other direction. Only worth doing once the profile has some
  // signal to match on -- an empty profile can't produce a meaningful score.
  const orConditions: Prisma.JobWhereInput[] = [];
  if (profile.commodities.length > 0) orConditions.push({ commodity: { in: profile.commodities } });
  if (profile.siteExperience.length > 0) orConditions.push({ siteType: { in: profile.siteExperience } });
  if (profile.countryCode) orConditions.push({ countryCode: profile.countryCode });
  if (profile.fifoPreference === "FIFO" || profile.fifoPreference === "DIDO") orConditions.push({ fifo: true });
  if (profile.fifoPreference === "RESIDENTIAL") orConditions.push({ fifo: false });

  const hasMatchSignal = orConditions.length > 0;
  const appliedJobIds = profile.applications.map((a) => a.jobId);

  const matchPool = hasMatchSignal
    ? await prisma.job.findMany({
        where: {
          status: "PUBLISHED",
          id: { notIn: appliedJobIds.length > 0 ? appliedJobIds : ["__none__"] },
          OR: orConditions,
        },
        include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
        orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
        take: 60,
      })
    : [];
  const matchedJobs = matchPool
    .map((job) => ({ job, ...scoreMatch({ candidate: profile, job }) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

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
          <Link href="/dashboard/candidate/preview" className="btn-ghost">Preview my profile</Link>
          <Link href="/dashboard/messages" className="btn-ghost">Messages</Link>
        </div>
      </div>

      {profileGaps.length > 0 && (
        <div className="mt-4 rounded-md border border-oregold/40 bg-oregold/10 px-4 py-3 text-sm">
          Complete your profile to apply faster -- missing: {profileGaps.join(", ")}.{" "}
          <Link href="/dashboard/candidate/profile" className="font-semibold underline">Fix now</Link>
        </div>
      )}

      {hasMatchSignal && matchedJobs.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl uppercase tracking-wide">Jobs matching you</h2>
          <p className="mt-1 text-xs text-ink/50">
            Based on your commodities, site experience, and roster preference -- same scoring employers see when
            they search candidates, run the other way.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {matchedJobs.map(({ job, score, reasons }) => (
              <div key={job.id}>
                <JobCard
                  job={job}
                  topRight={<span className="tag whitespace-nowrap bg-patina/15 text-patina">{score}% match</span>}
                />
                {reasons.length > 0 && (
                  <p className="mt-1 px-1 text-xs text-ink/50">{reasons.join(" Â· ")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {!hasMatchSignal && (
        <div className="card mt-8 text-sm text-ink/60">
          Add your commodities, site experience, or roster preference to{" "}
          <Link href="/dashboard/candidate/profile" className="underline">your profile</Link> to see jobs matched to
          you here.
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
                    <p className="text-xs text-ink/60">{a.job.company.name} Â· applied {timeAgo(a.createdAt)}</p>
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
                      {b.job.status !== "PUBLISHED" && <span className="text-oxide"> Â· no longer live</span>}
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

          <div>
            <h2 className="font-display text-xl uppercase tracking-wide">Saved searches</h2>
            {profile.savedSearches.length === 0 ? (
              <p className="card mt-3 text-sm text-ink/60">
                No saved searches yet. Save a search from{" "}
                <Link href="/jobs" className="underline">the jobs page</Link> to get emailed when new matches go live.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.savedSearches.map((s) => {
                  const params = new URLSearchParams();
                  if (s.commodity) params.set("commodity", s.commodity);
                  if (s.siteType) params.set("site", s.siteType);
                  if (s.countryCode) params.set("country", s.countryCode);
                  if (s.fifoOnly) params.set("fifo", "1");
                  if (s.minSalary != null) params.set("minSalary", String(s.minSalary));
                  const summary = [
                    s.commodity && s.commodity.toLowerCase().replace(/_/g, " "),
                    s.siteType && s.siteType.toLowerCase().replace(/_/g, " "),
                    s.countryCode,
                    s.fifoOnly && "FIFO only",
                    s.minSalary != null && `min $${s.minSalary.toLocaleString()}`,
                  ]
                    .filter(Boolean)
                    .join(" Â· ");
                  return (
                    <li key={s.id} className="card text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/jobs?${params}`} className="font-semibold hover:underline">
                          {s.label || summary || "All jobs"}
                        </Link>
                        <DeleteSavedSearchButton id={s.id} />
                      </div>
                      {s.label && summary && <p className="mt-1 text-xs text-ink/60">{summary}</p>}
                      <div className="mt-1">
                        <SavedSearchFrequencyToggle id={s.id} frequency={s.frequency} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <PromoteMeCard latest={profile.promotions[0] ?? null} />

          <div className="card border-ink/10 text-sm">
            <p className="font-semibold">Account settings</p>
            <p className="mt-1 text-ink/60">Change the email or password you sign in with.</p>
            <Link href="/dashboard/settings" className="mt-2 inline-block underline">
              Account settings â
            </Link>
          </div>

          <div className="card border-ink/10 text-sm">
            <p className="font-semibold">Your data, your call</p>
            <p className="mt-1 text-ink/60">Export or delete everything we hold about you.</p>
            <Link href="/dashboard/candidate/privacy" className="mt-2 inline-block underline">
              Privacy controls â
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
