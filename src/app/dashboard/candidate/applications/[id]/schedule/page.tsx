import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InterviewSlotPicker } from "@/components/InterviewSlotPicker";

export default async function ScheduleInterviewPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const application = await prisma.application.findFirst({
    where: { id: params.id, candidate: { userId: session.user.id } },
    include: {
      job: { select: { title: true, slug: true, company: { select: { name: true } } } },
      interviewSlots: { orderBy: { startsAt: "asc" } },
    },
  });
  if (!application) notFound();

  const slots = application.interviewSlots.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
    durationMinutes: s.durationMinutes,
    location: s.location,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm text-ink/60">
        <Link href="/dashboard/candidate" className="underline">Your applications</Link> / Schedule interview
      </p>
      <h1 className="mt-1 font-display text-3xl uppercase tracking-wide">{application.job.title}</h1>
      <p className="mt-1 text-sm text-ink/60">
        <Link href={`/jobs/${application.job.slug}`} className="underline">{application.job.company.name}</Link>
      </p>

      <div className="mt-6">
        {application.interviewScheduledAt ? (
          <div className="card">
            <p className="font-semibold text-patina">Interview confirmed</p>
            <p className="mt-1 text-sm text-ink/80">
              {new Date(application.interviewScheduledAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
            </p>
            {application.interviewLocation && (
              <p className="mt-1 text-sm text-ink/60">{application.interviewLocation}</p>
            )}
          </div>
        ) : slots.length > 0 ? (
          <>
            <p className="text-sm text-ink/60">
              {application.job.company.name} has proposed the times below. Pick whichever works for you — once
              you book a time, the others are no longer available.
            </p>
            <InterviewSlotPicker slots={slots} />
          </>
        ) : (
          <p className="card text-sm text-ink/60">
            No interview times have been proposed yet. Check back once the employer moves your application
            forward.
          </p>
        )}
      </div>
    </main>
  );
}
