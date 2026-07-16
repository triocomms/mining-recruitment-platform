import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId } });
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
    return NextResponse.json({ id: app.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 });
  }
}

const statusSchema = z.object({
  applicationId: z.string(),
  status: z.nativeEnum(ApplicationStatus),
});

/** Employers update status on applications to their own jobs;
 *  candidates may only withdraw their own applications. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = statusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const app = await prisma.application.findUnique({
    where: { id: parsed.data.applicationId },
    include: { job: { select: { company: { select: { ownerId: true } } } }, candidate: { select: { userId: true } } },
  });
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const isEmployerOwner = app.job.company.ownerId === session.user.id;
  const isCandidateOwner = app.candidate.userId === session.user.id;

  if (isCandidateOwner && parsed.data.status !== "WITHDRAWN") {
    return NextResponse.json({ error: "Candidates can only withdraw applications" }, { status: 403 });
  }
  if (!isEmployerOwner && !isCandidateOwner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.application.update({
    where: { id: app.id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}
