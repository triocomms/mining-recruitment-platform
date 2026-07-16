import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE"), jobId: z.string() }),
  z.object({
    action: z.literal("REJECT"),
    jobId: z.string(),
    reason: z.string().trim().min(3, "A rejection reason is required").max(1000),
  }),
]);

/** Admin review of PENDING_REVIEW job ads: approve → publish, reject → back to draft with a reason. */
export async function POST(req: NextRequest) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const job = await prisma.job.findUnique({
    where: { id: d.jobId },
    include: { company: { include: { subscription: true } } },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "Job is not awaiting review" }, { status: 400 });
  }

  if (d.action === "APPROVE") {
    const isGold =
      job.company.subscription?.status === "ACTIVE" && job.company.subscription.tier === "GOLD";
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHED",
        reviewNotes: null,
        isPriority: isGold,
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    await logAdminAction(user.id, "JOB_APPROVE", "JOB", job.id);
  } else {
    // Rejected ads return to DRAFT with the reason surfaced to the employer.
    // Quota was consumed at submission and is intentionally not refunded.
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "DRAFT", reviewNotes: d.reason },
    });
    await logAdminAction(user.id, "JOB_REJECT", "JOB", job.id, d.reason);
  }

  return NextResponse.json({ ok: true });
}
