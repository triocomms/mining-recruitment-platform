import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";
import { consumePublishSlot, getJobQuota } from "@/lib/quota";
import { detectSpamSignals, companyIsTrusted, jobHasUnresolvedFields, COUNTRY_NOT_DETECTED_FLAG } from "@/lib/moderation";
import { Commodity, EmploymentType, SalaryPeriod, SiteExperience, JobStatus } from "@prisma/client";

const jobSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(30),
  countryCode: z.string().length(2).transform((s) => s.toUpperCase()),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  employmentType: z.nativeEnum(EmploymentType).default("FULL_TIME"),
  commodity: z.nativeEnum(Commodity).optional(),
  siteType: z.nativeEnum(SiteExperience).optional(),
  roleCategory: z.string().trim().max(80).optional(),
  fifo: z.boolean().default(false),
  rosterPattern: z.string().trim().max(20).optional(),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  salaryCurrency: z.string().length(3).optional(),
  salaryPeriod: z.nativeEnum(SalaryPeriod).optional(),
  publish: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { ownerId: user.id },
    include: { subscription: true },
  });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const parsed = jobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  let status: JobStatus = "DRAFT";
  let moderationFlags: string[] = [];
  if (d.publish) {
    // Quota is consumed at submission time (not approval time) so a rejected
    // ad can't be re-submitted for free to bypass quota.
    const ok = await consumePublishSlot(company.id);
    if (!ok) {
      const quota = await getJobQuota(company.id);
      return NextResponse.json(
        { error: "Job ad quota reached for this billing period.", quota, action: "PURCHASE_OVERAGE" },
        { status: 402 }
      );
    }
    // Trust routing: verified companies with a clean history auto-publish;
    // new/unverified companies and spam-flagged ads await admin review.
    moderationFlags = await detectSpamSignals(company.id, d.title, d.description);
    const trusted =
      moderationFlags.length === 0 &&
      (await companyIsTrusted(company.id, company.verificationStatus));
    // Even a trusted company doesn't skip review if the country is
    // unresolved — trust covers spam/history, not data completeness.
    if (jobHasUnresolvedFields({ countryCode: d.countryCode })) {
      moderationFlags = [...moderationFlags, COUNTRY_NOT_DETECTED_FLAG];
      status = "PENDING_REVIEW";
    } else {
      status = trusted ? "PUBLISHED" : "PENDING_REVIEW";
    }
  }

  const isGold = company.subscription?.status === "ACTIVE" && company.subscription.tier === "GOLD";

  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      title: d.title,
      slug: makeSlug(d.title),
      description: d.description,
      countryCode: d.countryCode,
      region: d.region,
      city: d.city,
      employmentType: d.employmentType,
      commodity: d.commodity,
      siteType: d.siteType,
      roleCategory: d.roleCategory,
      fifo: d.fifo,
      rosterPattern: d.rosterPattern,
      salaryMin: d.salaryMin,
      salaryMax: d.salaryMax,
      salaryCurrency: d.salaryCurrency,
      salaryPeriod: d.salaryPeriod,
      status,
      moderationFlags,
      isPriority: status === "PUBLISHED" && isGold,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      expiresAt: status === "PUBLISHED" ? new Date(Date.now() + 30 * 24 * 3600 * 1000) : null,
    },
  });

  return NextResponse.json({ id: job.id, slug: job.slug, status: job.status }, { status: 201 });
}
