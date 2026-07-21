import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Report creation — the missing half of moderation's Report model. The admin
 * side (resolve/dismiss, src/app/api/admin/reports/route.ts) already existed;
 * there was previously no way for anyone to actually file one.
 *
 * Scoped to job ads only for now ("Report this ad" on the job detail page).
 * targetType is a free-form string on the Report model (also used for
 * MESSAGE/BLOG_POST/PROFILE/COMPANY/REVIEW elsewhere) — kept literal here
 * rather than generalizing to a reporting-anything endpoint that wasn't asked for.
 */

const REASON_LABELS: Record<string, string> = {
  SPAM_SCAM: "Spam or scam (e.g. asks for payment, fake recruiter)",
  MISLEADING: "Misleading — doesn't match the actual role",
  DISCRIMINATORY: "Discriminatory content",
  EXPIRED: "Role already filled or expired",
  OTHER: "Other",
};

const schema = z.object({
  targetType: z.literal("JOB"),
  targetId: z.string(),
  reason: z.enum(["SPAM_SCAM", "MISLEADING", "DISCRIMINATORY", "EXPIRED", "OTHER"]),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in to report a job ad" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: d.targetId }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // One open report per person per job — a duplicate click shouldn't create
  // a second queue entry; the admin side only needs to see it once.
  const existing = await prisma.report.findFirst({
    where: { reporterId: session.user.id, targetType: "JOB", targetId: d.targetId, status: "OPEN" },
  });
  if (existing) {
    return NextResponse.json({ error: "You've already reported this ad — it's awaiting review." }, { status: 409 });
  }

  const label = REASON_LABELS[d.reason];
  await prisma.report.create({
    data: {
      reporterId: session.user.id,
      targetType: "JOB",
      targetId: d.targetId,
      reason: d.comment ? `${label} — ${d.comment}` : label,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
