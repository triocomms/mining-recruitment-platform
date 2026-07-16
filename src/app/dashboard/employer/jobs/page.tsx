import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobQuota } from "@/lib/quota";
import { timeAgo } from "@/lib/utils";
import { JobPostForm } from "@/components/JobPostForm";
import { CsvImportForm } from "@/components/CsvImportForm";

export default async function EmployerJobsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { ownerId: session.user.id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { applications: true } } },
      },
    },
  });
  if (!company) redirect("/login");

  const quota = await getJobQuota(company.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Job ads</h1>
        <p className="text-sm text-ink/60">
          {quota.remaining} slot{quota.remaining === 1 ? "" : "s"} left
          {quota.overageCredits > 0 && ` · ${quota.overageCredits} overage credit${quota.overageCredits === 1 ? "" : "s"}`}
          {quota.needsOveragePurchase && (
            <>
              {" · "}
              <Link href="/dashboard/employer/billing" className="text-oxide underline">buy more</Link>
            </>
          )}
        </p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-xl uppercase tracking-wide">Post a job</h2>
          <div className="mt-3">
            <JobPostForm canPublish={quota.canPublish} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl uppercase tracking-wide">Bulk import (CSV)</h2>
          <div className="mt-3">
            <CsvImportForm />
          </div>

          <h2 className="mt-8 font-display text-xl uppercase tracking-wide">
            All ads ({company.jobs.length})
          </h2>
          {company.jobs.length === 0 ? (
            <p className="card mt-3 text-sm text-ink/60">Nothing posted yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {company.jobs.map((j) => (
                <li key={j.id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/jobs/${j.slug}`} className="block truncate font-semibold hover:underline">
                      {j.title}
                    </Link>
                    <p className="text-xs text-ink/60">
                      {j.countryCode}
                      {j.region ? ` · ${j.region}` : ""} · {j._count.applications} appl. · {timeAgo(j.createdAt)}
                      {j.source !== "MANUAL" && ` · ${j.source.toLowerCase()} import`}
                      {j.isPriority && " · priority"}
                    </p>
                  </div>
                  <span className={`tag shrink-0 ${j.status === "PUBLISHED" ? "bg-patina/15 text-patina" : j.status === "DRAFT" ? "bg-oregold/20" : ""}`}>
                    {j.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
