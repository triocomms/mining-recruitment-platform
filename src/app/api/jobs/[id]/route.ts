import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumePublishSlot, getJobQuota } from "@/lib/quota";
import { detectSpamSignals, companyIsTrusted, jobHasUnresolvedFields, COUNTRY_NOT_DETECTED_FLAG } from "@/lib/moderation";
import { Commodity, EmploymentType, SalaryPeriod, SiteExperience, Prisma } from "@prisma/client";

// Same field set as the create schema (src/app/api/jobs/route.ts) but every
// field optional — this is a partial edit, not a full replace. `submit`
// requests moving a DRAFT forward (first-time publish, or resubmitting a
// rejected one) rather than just saving field changes.
const editSchema = z.object({
  title: z.string().trim().min(4).max(120).optional(),
  description: z.string().trim().min(30).optional(),
  countryCode: z.string().length(2).transform((s) => s.toUpperCase()).optional(),
  region: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  commodity: z.nativeEnum(Commodity).nullable().optional(),
  siteType: z.nativeEnum(SiteExperience).nullable().optional(),
  roleCategory: z.string().trim().max(80).nullable().optional(),
  fifo: z.boolean().optional(),
  rosterPattern: z.string().trim().max(20).nullable().optional(),
  salaryMin: z.number().int().positive().nullable().optional(),
  salaryMax: z.number().int().positive().nullable().optional(),
  salaryCurrency: z.string().length(3).nullable().optional(),
  salaryPeriod: z.nativeEnum(SalaryPeriod).nullable().optional(),
  submit: z.boolean().optional(),
});

async function loadOwnedJob(id: string, userId: string) {
  return prisma.job.findFirst({
    where: { id, company: { ownerId: userId } },
    include: { company: { include: { subscription: true } }, _count: { select: { applications: true } } },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const job = await loadOwnedJob(params.id, user.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { submit, ...fields } = parsed.data;

  // Merge edited fields over the current row so the moderation gate below
  // (if triggered) checks the job as it will actually be saved, not the
  // stale pre-edit version.
  const merged = {
    title: fields.title ?? job.title,
    description: fields.description ?? job.description,
    countryCode: fields.countryCode ?? job.countryCode,
  };

  const data: Prisma.JobUpdateInput = { ...fields };

  // Only a DRAFT can be "submitted" — PENDING_REVIEW is already submitted
  // and awaiting a decision, and PUBLISHED/EXPIRED/ARCHIVED don't apply.
  if (submit && job.status === "DRAFT") {
    // A rejected draft (reviewNotes set) already consumed a publish slot at
    // its original submission — resubmitting it must not charge a second
    // slot for the same ad. A draft that was only ever saved (never
    // submitted) has never been charged, so this is its first real charge.
    const alreadyConsumed = job.reviewNotes !== null;
    if (!alreadyConsumed) {
      const ok = await consumePublishSlot(job.companyId);
      if (!ok) {
        const quota = await getJobQuota(job.companyId);
        return NextResponse.json(
          { error: "Job ad quota reached for this billing period.", quota, action: "PURCHASE_OVERAGE" },
          { status: 402 }
        );
      }
    }

    // excludeJobId: this row already exists, so the duplicate-content check
    // must not compare it against itself.
    const moderationFlags = await detectSpamSignals(job.companyId, merged.title, merged.description, job.id);
    const trusted =
      moderationFlags.length === 0 &&
      (await companyIsTrusted(job.companyId, job.company.verificationStatus));
    const isGold = job.company.subscription?.status === "ACTIVE" && job.company.subscription.tier === "GOLD";

    let status: "PENDING_REVIEW" | "PUBLISHED";
    let finalFlags = moderationFlags;
    if (jobHasUnresolvedFields({ countryCode: merged.countryCode })) {
      finalFlags = [...moderationFlags, COUNTRY_NOT_DETECTED_FLAG];
      status = "PENDING_REVIEW";
    } else {
      status = trusted ? "PUBLISHED" : "PENDING_REVIEW";
    }

    data.status = status;
    data.reviewNotes = null;
    data.moderationFlags = finalFlags;
    data.isPriority = status === "PUBLISHED" && isGold;
    data.publishedAt = status === "PUBLISHED" ? new Date() : null;
    data.expiresAt = status === "PUBLISHED" ? new Date(Date.now() + 30 * 24 * 3600 * 1000) : null;
  }

  const updated = await prisma.job.update({ where: { id: job.id }, data });
  return NextResponse.json({ id: updated.id, slug: updated.slug, status: updated.status });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const job = await loadOwnedJob(params.id, user.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // A DRAFT with no applications was never visible publicly and has no
  // history worth keeping — safe to remove outright. Anything else
  // (published, expired, under review, or a draft that somehow picked up
  // applications) is archived instead: hidden from every public query the
  // same way DRAFT already is, but keeps application history intact and
  // avoids resurrecting RSS-imported jobs on the next feed sync (which key
  // off the row still existing).
  if (job.status === "DRAFT" && job._count.applications === 0) {
    await prisma.job.delete({ where: { id: job.id } });
    return NextResponse.json({ ok: true, mode: "deleted" });
  }

  await prisma.job.update({ where: { id: job.id }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ ok: true, mode: "archived" });
}
