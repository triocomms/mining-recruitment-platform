import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Report creation -- the missing half of moderation's Report model. The admin
 * side (resolve/dismiss, src/app/api/admin/reports/route.ts) already existed
 * and can already resolve REVIEW-targeted reports (hides the review) -- this
 * route just needed to accept them.
 *
 * targetType is a free-form string on the Report model (also used for
 * MESSAGE/BLOG_POST/PROFILE/COMPANY elsewhere) -- JOB and REVIEW are the two
 * wired up here; extend the same pattern rather than genericizing further
 * until another target actually needs it.
 */

const JOB_REASON_LABELS: Record<string, string> = {
  SPAM_SCAM: "Spam or scam (e.g. asks for payment, fake recruiter)",
  MISLEADING: "Misleading -- doesn't match the actual role",
  DISCRIMINATORY: "Discriminatory content",
  EXPIRED: "Role already filled or expired",
  OTHER: "Other",
};

const REVIEW_REASON_LABELS: Record<string, string> = {
  FAKE_NOT_A_CANDIDATE: "Doesn't look like a genuine candidate review",
  DEFAMATORY_ABUSIVE: "Defamatory, abusive, or personal attack",
  DISCRIMINATORY: "Discriminatory content",
  CONFIDENTIAL_INFO: "Reveals confidential or identifying information",
  OTHER: "Other",
};

const schema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("JOB"),
    targetId: z.string(),
    reason: z.enum(["SPAM_SCAM", "MISLEADING", "DISCRIMINATORY", "EXPIRED", "OTHER"]),
    comment: z.string().trim().max(1000).optional(),
  }),
  z.object({
    targetType: z.literal("REVIEW"),
    targetId: z.string(),
    reason: z.enum(["FAKE_NOT_A_CANDIDATE", "DEFAMATORY_ABUSIVE", "DISCRIMINATORY", "CONFIDENTIAL_INFO", "OTHER"]),
    comment: z.string().trim().max(1000).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in to report this" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;

  let label: string;

  if (d.targetType === "JOB") {
    const job = await prisma.job.findUnique({ where: { id: d.targetId }, select: { id: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    label = JOB_REASON_LABELS[d.reason];
  } else {
    const review = await prisma.companyReview.findUnique({
      where: { id: d.targetId },
      select: { id: true, candidateId: true },
    });
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    // Can't report your own review -- use the edit form on the company page instead.
    const ownProfile = await prisma.candidateProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (ownProfile && ownProfile.id === review.candidateId) {
      return NextResponse.json({ error: "You can't report your own review" }, { status: 400 });
    }
    label = REVIEW_REASON_LABELS[d.reason];
  }

  // One open report per person per target -- a duplicate click shouldn't
  // create a second queue entry; the admin side only needs to see it once.
  const existing = await prisma.report.findFirst({
    where: { reporterId: session.user.id, targetType: d.targetType, targetId: d.targetId, status: "OPEN" },
  });
  if (existing) {
    return NextResponse.json({ error: "You've already reported this -- it's awaiting review." }, { status: 409 });
  }

  await prisma.report.create({
    data: {
      reporterId: session.user.id,
      targetType: d.targetType,
      targetId: d.targetId,
      reason: d.comment ? `${label} -- ${d.comment}` : label,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
