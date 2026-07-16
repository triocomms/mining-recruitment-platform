import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJobsCsv } from "@/lib/csv-import";
import { makeSlug } from "@/lib/utils";
import { getJobQuota, consumePublishSlot } from "@/lib/quota";

/**
 * CSV bulk upload. multipart/form-data with a `file` field.
 * Valid rows within quota are published; valid rows beyond quota are saved
 * as DRAFTs; invalid rows are returned with line numbers.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a CSV file" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "CSV must be under 2 MB" }, { status: 400 });

  let parsedCsv;
  try {
    parsedCsv = parseJobsCsv(await file.text());
  } catch {
    return NextResponse.json({ error: "Could not parse CSV. Check the template format." }, { status: 400 });
  }
  const { rows, errors } = parsedCsv;
  if (rows.length > 200) {
    return NextResponse.json({ error: "Maximum 200 rows per import" }, { status: 400 });
  }

  const quotaBefore = await getJobQuota(company.id);
  let published = 0;
  let drafted = 0;
  let skippedDuplicates = 0;

  for (const { data } of rows) {
    // Dedupe on external_ref so re-importing the same file is safe.
    if (data.external_ref) {
      const dup = await prisma.job.findUnique({
        where: { companyId_externalRef: { companyId: company.id, externalRef: data.external_ref } },
      });
      if (dup) {
        skippedDuplicates++;
        continue;
      }
    }
    const canPublish = await consumePublishSlot(company.id);
    await prisma.job.create({
      data: {
        companyId: company.id,
        title: data.title,
        slug: makeSlug(data.title),
        description: data.description,
        countryCode: data.country_code,
        region: data.region || null,
        city: data.city || null,
        employmentType: data.employment_type,
        commodity: data.commodity,
        siteType: data.site_type,
        roleCategory: data.role_category || null,
        fifo: data.fifo,
        rosterPattern: data.roster_pattern || null,
        salaryMin: data.salary_min,
        salaryMax: data.salary_max,
        salaryCurrency: data.salary_currency,
        salaryPeriod: data.salary_period,
        applyUrl: data.apply_url,
        externalRef: data.external_ref,
        source: "CSV",
        status: canPublish ? "PUBLISHED" : "DRAFT",
        publishedAt: canPublish ? new Date() : null,
        expiresAt: canPublish ? new Date(Date.now() + 30 * 24 * 3600 * 1000) : null,
      },
    });
    canPublish ? published++ : drafted++;
  }

  return NextResponse.json({
    summary: {
      totalRows: rows.length + errors.length,
      published,
      draftedOverQuota: drafted,
      skippedDuplicates,
      failed: errors.length,
    },
    quotaBefore,
    quotaAfter: await getJobQuota(company.id),
    errors,
  });
}
