import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { jobHasUnresolvedFields } from "@/lib/moderation";
import type { Job, Company, Subscription } from "@prisma/client";

// Bulk approve loops sequentially (DB update + audit log + email per job),
// same shape as the daily cron's per-feed loop — give it the same headroom.
export const maxDuration = 60;

const MAX_BULK_APPROVE = 200;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE"), jobId: z.string() }),
  z.object({
    action: z.literal("REJECT"),
    jobId: z.string(),
    reason: z.string().trim().min(3, "A rejection reason is required").max(1000),
  }),
  z.object({
    action: z.literal("BULK_APPROVE"),
    jobIds: z.array(z.string()).min(1, "Select at least one job").max(MAX_BULK_APPROVE),
  }),
]);

type JobWithCompany = Job & { company: Company & { subscription: Subscription | null; owner: { email: string } } };

/** Publish a single PENDING_REVIEW job. Caller must have already confirmed status. */
async function approveJob(job: JobWithCompany, adminId: string) {
  const isGold = job.company.subscription?.status === "ACTIVE" && job.company.subscription.tier === "GOLD";
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
  await logAdminAction(adminId, "JOB_APPROVE", "JOB", job.id);
  await sendEmail({
    to: job.company.owner.email,
    subject: `Your job ad "${job.title}" is now live`,
    body: `Your ad "${job.title}" passed review and is now published on Orebridge. It will run for 30 days.`,
    template: "JOB_APPROVED",
  });
}

/** Admin review of PENDING_REVIEW job ads: approve → publish, reject → back to draft with a reason. */
export async function POST(req: NextRequest) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  if (d.action === "BULK_APPROVE") {
    // Re-check status per job rather than trusting the client's selection —
    // the queue can move between the admin loading the page and submitting
    // (another admin acting first, employer editing back to draft, etc).
    const jobs = await prisma.job.findMany({
      where: { id: { in: d.jobIds }, status: "PENDING_REVIEW" },
      include: { company: { include: { subscription: true, owner: { select: { email: true } } } } },
    });

    // Bulk approval must not be how an unresolved-country job (e.g. RSS's
    // "ZZ" sentinel) slips through — that's exactly the failure mode this
    // check exists to close off. Blocked jobs stay in the queue; reject
    // them with a reason instead so the employer can fix the location.
    let approved = 0;
    let blockedUnresolvedCountry = 0;
    for (const job of jobs) {
      if (jobHasUnresolvedFields(job)) {
        blockedUnresolvedCountry++;
        continue;
      }
      await approveJob(job, user.id);
      approved++;
    }

    return NextResponse.json({
      ok: true,
      approved,
      blockedUnresolvedCountry,
      // already handled, deleted, or raced by the time we looked
      skipped: d.jobIds.length - approved - blockedUnresolvedCountry,
    });
  }

  const job = await prisma.job.findUnique({
    where: { id: d.jobId },
    include: { company: { include: { subscription: true, owner: { select: { email: true } } } } },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "Job is not awaiting review" }, { status: 400 });
  }

  if (d.action === "APPROVE") {
    if (jobHasUnresolvedFields(job)) {
      return NextResponse.json(
        { error: "This job's country couldn't be confirmed — reject it with a reason instead of approving." },
        { status: 400 }
      );
    }
    await approveJob(job, user.id);
  } else {
    // Rejected ads return to DRAFT with the reason surfaced to the employer.
    // Quota was consumed at submission and is intentionally not refunded.
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "DRAFT", reviewNotes: d.reason },
    });
    await logAdminAction(user.id, "JOB_REJECT", "JOB", job.id, d.reason);
    await sendEmail({
      to: job.company.owner.email,
      subject: `Your job ad "${job.title}" needs changes`,
      body: `Your ad "${job.title}" was reviewed and returned to draft.\n\nReason: ${d.reason}\n\nEdit and re-submit it from your employer dashboard.`,
      template: "JOB_REJECTED",
    });
  }

  return NextResponse.json({ ok: true });
}
