import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  companyId: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20, "Please write at least a couple of sentences").max(2000),
});

export async function POST(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });

  const interviewed = await prisma.application.findFirst({
    where: { candidateId: candidate.id, job: { companyId: d.companyId }, interviewedAt: { not: null } },
    select: { id: true },
  });
  if (!interviewed) {
    return NextResponse.json(
      { error: "You can only review companies you've reached interview stage with" },
      { status: 403 }
    );
  }

  const existing = await prisma.companyReview.findUnique({
    where: { companyId_candidateId: { companyId: d.companyId, candidateId: candidate.id } },
    select: { status: true },
  });

  // A review an admin has upheld a report against and hidden stays hidden
  // through an edit -- otherwise a candidate could silently undo moderation
  // just by re-saving the form with no real change. Only an admin
  // (src/app/api/admin/reports/route.ts) can restore it to PUBLISHED.
  const nextStatus = existing?.status === "HIDDEN" ? "HIDDEN" : "PUBLISHED";

  const review = await prisma.companyReview.upsert({
    where: { companyId_candidateId: { companyId: d.companyId, candidateId: candidate.id } },
    create: {
      companyId: d.companyId,
      candidateId: candidate.id,
      rating: d.rating,
      title: d.title,
      body: d.body,
    },
    update: { rating: d.rating, title: d.title, body: d.body, status: nextStatus },
  });

  return NextResponse.json({ ok: true, id: review.id, status: review.status });
}
