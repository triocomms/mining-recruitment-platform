import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const slotSchema = z.object({
  // Sent as a full UTC ISO string (the client converts its
  // <input type="datetime-local"> value with `new Date(...).toISOString()`
  // in the employer's own browser) so the server never has to guess a
  // timezone.
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(10).max(480).default(30),
  location: z.string().trim().max(300).optional(),
});

const createSchema = z.object({
  applicationId: z.string(),
  slots: z.array(slotSchema).min(1).max(5),
});

/** Employer proposes one or more interview time slots for an application --
 *  moves it to INTERVIEW stage (same bookkeeping as a plain status change)
 *  and emails the candidate a link to pick one. Re-proposing before any slot
 *  is booked replaces the earlier, unbooked offer rather than piling up
 *  stale options; re-proposing after a slot is booked is a no-op. */
export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const d = parsed.data;

  const app = await prisma.application.findFirst({
    where: { id: d.applicationId, job: { company: { ownerId: user.id } } },
    include: {
      job: { select: { id: true, title: true, company: { select: { name: true } } } },
      candidate: { select: { userId: true, user: { select: { email: true } } } },
    },
  });
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (!app.interviewScheduledAt) {
    await prisma.interviewSlot.deleteMany({ where: { applicationId: app.id } });
    await prisma.interviewSlot.createMany({
      data: d.slots.map((s) => ({
        applicationId: app.id,
        startsAt: new Date(s.startsAt),
        durationMinutes: s.durationMinutes,
        location: s.location || null,
      })),
    });
  }

  await prisma.application.update({
    where: { id: app.id },
    data: {
      ...(app.status !== "OFFER" ? { status: "INTERVIEW" } : {}),
      ...(!app.interviewedAt ? { interviewedAt: new Date() } : {}),
    },
  });

  if (!app.interviewScheduledAt) {
    const title = "Interview times available";
    const body = `${app.job.company.name} has proposed interview times for "${app.job.title}". Pick one that works from your dashboard.`;
    const scheduleUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/candidate/applications/${app.id}/schedule`;
    notifyUser({
      userId: app.candidate.userId,
      type: "APPLICATION_STATUS",
      title,
      body,
      linkUrl: `/dashboard/candidate/applications/${app.id}/schedule`,
      email: {
        to: app.candidate.user.email,
        subject: title,
        body: `${body}\n\n${scheduleUrl}`,
        template: "APPLICATION_STATUS",
      },
    }).catch((e) => console.error("[interview-slots] notification failed", e));
  }

  return NextResponse.json({ ok: true });
}

/** Employer withdraws a still-unanswered set of proposed times (e.g. to
 *  offer different ones instead of piling on more). Refuses once a slot has
 *  already been booked -- cancelling a confirmed interview isn't this
 *  endpoint's job. */
export async function DELETE(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const applicationId = req.nextUrl.searchParams.get("applicationId");
  if (!applicationId) return NextResponse.json({ error: "applicationId is required" }, { status: 400 });

  const app = await prisma.application.findFirst({
    where: { id: applicationId, job: { company: { ownerId: user.id } } },
  });
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (app.interviewScheduledAt) {
    return NextResponse.json({ error: "This interview is already booked" }, { status: 409 });
  }

  await prisma.interviewSlot.deleteMany({ where: { applicationId } });
  return NextResponse.json({ ok: true });
}
