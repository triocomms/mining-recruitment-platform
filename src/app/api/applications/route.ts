import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { ApplicationStatus } from "@prisma/client";

const applySchema = z.object({
  jobId: z.string(),
  coverNote: z.string().trim().max(3000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Sign in as a candidate to apply" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });
  if (!candidate.resumeKey) {
    return NextResponse.json({ error: "Upload a resume before applying", action: "UPLOAD_RESUME" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: parsed.data.jobId },
    include: { company: { select: { name: true, owner: { select: { email: true } } } } },
  });
  if (!job || job.status !== "PUBLISHED") {
    return NextResponse.json({ error: "This job is no longer accepting applications" }, { status: 404 });
  }

  try {
    const app = await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,
        coverNote: parsed.data.coverNote,
        resumeKey: candidate.resumeKey, // snapshot
      },
    });
    // Best-effort — an employer not being notified shouldn't fail the
    // candidate's application. Their only other signal today is the
    // applicant count on the employer jobs page, so this matters: without
    // it there's no prompt to ever open the pipeline and act on it.
    sendEmail({
      to: job.company.owner.email,
      subject: `New application: ${job.title}`,
      body: `${candidate.firstName} ${candidate.lastName} applied to "${job.title}".\n\nReview it from your employer dashboard under this job's Applicants.`,
      template: "NEW_APPLICATION",
    }).catch((e) => console.error("[applications] employer notification failed", e));
    return NextResponse.json({ id: app.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 });
  }
}

const patchSchema = z
  .object({
    applicationId: z.string(),
    status: z.nativeEnum(ApplicationStatus).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, { message: "Nothing to update" });

/** Employers update status and/or leave private notes on applications to
 *  their own jobs; candidates may only withdraw their own applications and
 *  can never set notes (notes are the employer's hiring record, not shared). */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const d = parsed.data;

  const app = await prisma.application.findUnique({
    where: { id: d.applicationId },
    include: { job: { select: { company: { select: { ownerId: true } } } }, candidate: { select: { userId: true } } },
  });
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const isEmployerOwner = app.job.company.ownerId === session.user.id;
  const isCandidateOwner = app.candidate.userId === session.user.id;
  if (!isEmployerOwner && !isCandidateOwner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (d.notes !== undefined && !isEmployerOwner) {
    return NextResponse.json({ error: "Only the hiring employer can leave notes" }, { status: 403 });
  }
  if (d.status !== undefined && isCandidateOwner && !isEmployerOwner && d.status !== "WITHDRAWN") {
    return NextResponse.json({ error: "Candidates can only withdraw applications" }, { status: 403 });
  }

  await prisma.application.update({
    where: { id: app.id },
    data: {
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

/** List applicants for one of the caller's own jobs — the employer-facing
 *  side of the applicant tracking pipeline. */
export async function GET(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const job = await prisma.job.findFirst({
    where: { id: jobId, company: { ownerId: user.id } },
    select: { id: true, title: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const applications = await prisma.application.findMany({
    where: { jobId },
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
          yearsExperience: true,
          resumeKey: true,
          phone: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return NextResponse.json({ job, applications });
}
