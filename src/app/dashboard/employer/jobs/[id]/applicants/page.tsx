import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo, formatLocation } from "@/lib/utils";
import { ApplicantPipeline } from "@/components/ApplicantPipeline";

export default async function ApplicantsPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const job = await prisma.job.findFirst({
    where: { id: params.id, company: { ownerId: session.user.id } },
    select: { id: true, title: true, slug: true },
  });
  if (!job) notFound();

  const applications = await prisma.application.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          headline: true,
          countryCode: true,
          region: true,
          city: true,
          yearsExperience: true,
          resumeKey: true,
          phone: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-ink/60">
        <Link href="/dashboard/employer/jobs" className="underline">Your jobs</Link> / Applicants
      </p>
      <h1 className="mt-1 font-display text-3xl uppercase tracking-wide">{job.title}</h1>
      <p className="mt-1 text-sm text-ink/60">
        <Link href={`/jobs/${job.slug}`} className="underline">View public listing</Link> Â· {applications.length}{" "}
        applicant{applications.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6">
        <ApplicantPipeline
          applications={applications.map((a) => ({
            id: a.id,
            status: a.status,
            notes: a.notes ?? "",
            coverNote: a.coverNote,
            resumeKey: a.resumeKey,
            resumeName: a.resumeName,
            coverLetterKey: a.coverLetterKey,
            coverLetterName: a.coverLetterName,
            appliedAgo: timeAgo(a.createdAt),
            candidate: {
              id: a.candidate.id,
              name: `${a.candidate.firstName} ${a.candidate.lastName}`,
              email: a.candidate.user.email,
              phone: a.candidate.phone,
              headline: a.candidate.headline,
              location: formatLocation(a.candidate.city, a.candidate.region, a.candidate.countryCode),
              yearsExperience: a.candidate.yearsExperience,
            },
          }))}
        />
      </div>
    </main>
  );
}
