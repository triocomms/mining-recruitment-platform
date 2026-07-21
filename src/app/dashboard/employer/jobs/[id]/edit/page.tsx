import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobQuota } from "@/lib/quota";
import { EditJobForm } from "@/components/EditJobForm";

export default async function EditJobPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const job = await prisma.job.findFirst({
    where: { id: params.id, company: { ownerId: session.user.id } },
  });
  if (!job) notFound();

  const quota = await getJobQuota(job.companyId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-ink/60">
        <Link href="/dashboard/employer/jobs" className="underline">Your jobs</Link> / Edit
      </p>
      <h1 className="mt-1 font-display text-3xl uppercase tracking-wide">Edit job</h1>
      {job.status === "DRAFT" && job.reviewNotes && (
        <p className="card mt-3 text-sm text-oxide">
          Rejected by moderation: {job.reviewNotes}. Fix the issue below, then resubmit.
        </p>
      )}

      <div className="mt-6">
        <EditJobForm
          jobId={job.id}
          status={job.status}
          isRejected={job.status === "DRAFT" && job.reviewNotes !== null}
          canPublish={quota.canPublish}
          initial={{
            title: job.title,
            description: job.description,
            countryCode: job.countryCode,
            region: job.region ?? "",
            city: job.city ?? "",
            employmentType: job.employmentType,
            commodity: job.commodity ?? "",
            siteType: job.siteType ?? "",
            roleCategory: job.roleCategory ?? "",
            fifo: job.fifo,
            rosterPattern: job.rosterPattern ?? "",
            salaryMin: job.salaryMin?.toString() ?? "",
            salaryMax: job.salaryMax?.toString() ?? "",
            salaryCurrency: job.salaryCurrency ?? "",
            salaryPeriod: job.salaryPeriod ?? "",
          }}
        />
      </div>
    </main>
  );
}
