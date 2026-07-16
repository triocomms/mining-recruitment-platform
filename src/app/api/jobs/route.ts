import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";
import { consumePublishSlot, getJobQuota } from "@/lib/quota";
import { Commodity, EmploymentType, SalaryPeriod, SiteExperience } from "@prisma/client";

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

  let status: "DRAFT" | "PUBLISHED" = "DRAFT";
  if (d.publish) {
    const ok = await consumePublishSlot(company.id);
    if (!ok) {
      const quota = await getJobQuota(company.id);
      return NextResponse.json(
        { error: "Job ad quota reached for this billing period.", quota, action: "PURCHASE_OVERAGE" },
        { status: 402 }
      );
    }
    status = "PUBLISHED";
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
      isPriority: status === "PUBLISHED" && isGold,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      expiresAt: status === "PUBLISHED" ? new Date(Date.now() + 30 * 24 * 3600 * 1000) : null,
    },
  });

  return NextResponse.json({ id: job.id, slug: job.slug, status: job.status }, { status: 201 });
}
