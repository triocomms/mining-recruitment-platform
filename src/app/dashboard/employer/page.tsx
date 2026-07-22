import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobQuota } from "@/lib/quota";
import { PLANS } from "@/lib/plans";
import { timeAgo } from "@/lib/utils";
import { FileUpload } from "@/components/FileUpload";
import { CompanyForm } from "@/components/CompanyForm";

const VERIFY_COPY: Record<string, { label: string; tone: string; note: string }> = {
  UNVERIFIED: {
    label: "Not verified",
    tone: "bg-bone text-ink/60",
    note: "Upload a business registration document below to start verification. Verified badges unlock candidate outreach and resume search.",
  },
  PENDING: {
    label: "Under review",
    tone: "bg-oregold/20 text-ink",
    note: "Our team is reviewing your documents. This usually takes 1–2 business days.",
  },
  VERIFIED: {
    label: "Verified ✓",
    tone: "bg-patina/15 text-patina",
    note: "Your company carries a verified badge on all listings.",
  },
  REJECTED: {
    label: "Verification declined",
    tone: "bg-oxide/10 text-oxide",
    note: "Your last submission was declined. Check the notes below and re-upload corrected documents.",
  },
};

export default async function EmployerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { ownerId: session.user.id },
    include: {
      subscription: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { applications: true } } },
      },
      threads: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      bookmarks: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { candidate: { select: { id: true, firstName: true, lastName: true, headline: true } } },
      },
      _count: { select: { followers: true } },
    },
  });
  if (!company) redirect("/login");

  const quota = await getJobQuota(company.id);
  const verify = VERIFY_COPY[company.verificationStatus];
  const plan = company.subscription?.status === "ACTIVE" ? PLANS[company.subscription.tier] : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">{company.name}</h1>
          <p className="mt-1 text-sm text-ink/60">
            <span className={`tag ${verify.tone}`}>{verify.label}</span>
            <span className="ml-2">{company._count.followers} follower{company._count.followers === 1 ? "" : "s"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/employer/jobs" className="btn-primary">Post a job</Link>
          <Link href="/dashboard/posts/new" className="btn-ghost">Write a news post</Link>
          <Link href="/dashboard/posts" className="btn-ghost">My posts</Link>
          <Link href="/dashboard/messages" className="btn-ghost">Messages</Link>
          <Link href="/dashboard/employer/billing" className="btn-ghost">Billing</Link>
        </div>
      </div>

      {/* Quota widget */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="label">Plan</p>
          <p className="font-display text-2xl uppercase">{plan ? plan.label : "Free trial"}</p>
          <p className="text-xs text-ink/60">
            {plan ? `${plan.jobQuota} ads / month` : `${quota.quota} free ad`}
            {plan?.resumeSearch && " · resume search"}
            {plan?.priorityPlacement && " · priority placement"}
          </p>
        </div>
        <div className="card">
          <p className="label">Ads used this period</p>
          <p className="font-display text-2xl">{quota.used} <span className="text-ink/40">/ {quota.quota}</span></p>
          <div className="mt-2 h-2 overflow-hidden rounded bg-ink/10">
            <div
              className={`h-full ${quota.remaining === 0 ? "bg-oxide" : "bg-patina"}`}
              style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.quota)) * 100)}%` }}
            />
          </div>
        </div>
        <div className="card">
          <p className="label">Overage credits</p>
          <p className="font-display text-2xl">{quota.overageCredits}</p>
          {quota.needsOveragePurchase && (
            <Link href="/dashboard/employer/billing" className="text-xs text-oxide underline">
              Quota exhausted — buy a single post or upgrade →
            </Link>
          )}
        </div>
      </section>

      {/* Verification */}
      <section className="card mt-6">
        <h2 className="font-display text-xl uppercase tracking-wide">Company verification (KYB)</h2>
        <p className="mt-1 text-sm text-ink/60">{verify.note}</p>
        {company.verificationStatus === "REJECTED" && company.kybNotes && (
          <p className="mt-2 rounded bg-oxide/10 p-2 text-sm text-oxide">Reviewer notes: {company.kybNotes}</p>
        )}
        {company.verificationStatus !== "VERIFIED" && (
          <div className="mt-3 max-w-sm">
            <FileUpload
              kind="kyb"
              label="Business registration document (PDF)"
              accept=".pdf"
              field="kybDocumentKey"
              endpoint="/api/company"
              currentKey={company.kybDocumentKey}
            />
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        <section className="md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl uppercase tracking-wide">Recent jobs</h2>
            <Link href="/dashboard/employer/jobs" className="text-sm underline">Manage all →</Link>
          </div>
          {company.jobs.length === 0 ? (
            <p className="card mt-3 text-sm text-ink/60">
              No jobs yet. <Link href="/dashboard/employer/jobs" className="underline">Post your first ad</Link> — it&rsquo;s on us.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {company.jobs.map((j) => (
                <li key={j.id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/jobs/${j.slug}`} className="block truncate font-semibold hover:underline">
                      {j.title}
                    </Link>
                    <p className="text-xs text-ink/60">
                      {j._count.applications} application{j._count.applications === 1 ? "" : "s"} · {timeAgo(j.createdAt)}
                    </p>
                  </div>
                  <span className={`tag shrink-0 ${j.status === "PUBLISHED" ? "bg-patina/15 text-patina" : ""}`}>
                    {j.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 font-display text-xl uppercase tracking-wide">Recent conversations</h2>
          {company.threads.length === 0 ? (
            <p className="card mt-3 text-sm text-ink/60">No conversations yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {company.threads.map((t) => (
                <li key={t.id} className="card">
                  <Link href={`/dashboard/messages/${t.id}`} className="block">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {t.candidate.firstName} {t.candidate.lastName}
                      </span>
                      <span className="text-xs text-ink/50">{timeAgo(t.updatedAt)}</span>
                    </div>
                    {t.messages[0] && <p className="mt-1 truncate text-sm text-ink/60">{t.messages[0].body}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-8">
          <div>
            <h2 className="font-display text-xl uppercase tracking-wide">Bookmarked candidates</h2>
            {company.bookmarks.length === 0 ? (
              <p className="card mt-3 text-sm text-ink/60">
                None yet.{" "}
                {plan?.resumeSearch ? (
                  <Link href="/dashboard/employer/candidates" className="underline">Search the resume database</Link>
                ) : (
                  <>Resume database search is a Gold feature.</>
                )}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {company.bookmarks.map((b) => (
                  <li key={b.candidateId} className="card text-sm">
                    <p className="font-semibold">{b.candidate.firstName} {b.candidate.lastName}</p>
                    {b.candidate.headline && <p className="text-xs text-ink/60">{b.candidate.headline}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold">Company page</h2>
            <p className="mt-1 text-sm text-ink/60">
              Public at <Link href={`/companies/${company.slug}`} className="underline">/companies/{company.slug}</Link>
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">Company details</h2>
        <div className="mt-3">
          <CompanyForm
            initial={{
              name: company.name,
              website: company.website ?? "",
              description: company.description ?? "",
              countryCode: company.countryCode ?? "",
              size: company.size ?? "",
              logoKey: company.logoKey,
              galleryKeys: company.galleryKeys,
              videoUrl: company.videoUrl ?? "",
            }}
          />
        </div>
      </section>
    </main>
  );
}
