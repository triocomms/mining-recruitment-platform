import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

/** Candidate books one of the interview times their employer proposed -- the
 *  only mutation a candidate can make against InterviewSlot. Booking is
 *  exclusive: it stamps the winning time onto the Application row (the
 *  single source of truth the employer pipeline and candidate dashboard both
 *  read) and clears out the other unbooked offers for the same application. */
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Sign in as a candidate to book a time" }, { status: 403 });

  const slot = await prisma.interviewSlot.findUnique({
    where: { id: params.id },
    include: {
      application: {
        select: {
          id: true,
          interviewScheduledAt: true,
          candidate: { select: { userId: true } },
          job: { select: { id: true, title: true, company: { select: { name: true, ownerId: true } } } },
        },
      },
    },
  });
  if (!slot || slot.application.candidate.userId !== user.id) {
    return NextResponse.json({ error: "Interview slot not found" }, { status: 404 });
  }
  if (slot.application.interviewScheduledAt) {
    return NextResponse.json({ error: "An interview time has already been booked" }, { status: 409 });
  }

  await prisma.application.update({
    where: { id: slot.application.id },
    data: { interviewScheduledAt: slot.startsAt, interviewLocation: slot.location },
  });
  await prisma.interviewSlot.deleteMany({ where: { applicationId: slot.application.id } });

  notifyUser({
    userId: slot.application.job.company.ownerId,
    type: "APPLICATION_STATUS",
    title: "Interview time booked",
    body: `A candidate booked an interview time for "${slot.application.job.title}".`,
    linkUrl: `/dashboard/employer/jobs/${slot.application.job.id}/applicants`,
  }).catch((e) => console.error("[interview-slots] employer notification failed", e));

  return NextResponse.json({ ok: true });
}
