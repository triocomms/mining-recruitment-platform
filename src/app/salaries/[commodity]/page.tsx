import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugToCommodity, MIN_SALARY_SAMPLE_SIZE } from "@/lib/utils";
import { Commodity } from "@prisma/client";

export const revalidate = 3600;

const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function periodSuffix(period: string | null) {
  return period === "HOUR" ? "/hr" : period === "DAY" ? "/day" : period === "YEAR" ? "/yr" : "";
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function parseCommodity(slug: string): Commodity | null {
  const value = slugToCommodity(slug);
  return (Object.values(Commodity) as string[]).includes(value) ? (value as Commodity) : null;
}

export async function generateMetadata({ params }: { params: { commodity: string } }) {
  const commodity = parseCommodity(params.commodity);
  if (!commodity) return { title: "Salary guide — Orebridge" };
  return {
    title: `${pretty(commodity)} salaries — mining & resources pay guide`,
    description: `Typical pay ranges for ${pretty(commodity)} roles in mining and resources, based on live job ads on Orebridge.`,
  };
}

export default async function CommoditySalaryPage({ params }: { params: { commodity: string } }) {
  const commodity = parseCommodity(params.commodity);
  if (!commodity) notFound();

  const groups = await prisma.job.groupBy({
    by: ["siteType", "salaryCurrency", "salaryPeriod"],
    where: {
      status: "PUBLISHED",
      commodity,
      salaryCurrency: { not: null },
      OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
    },
    _avg: { salaryMin: true, salaryMax: true },
    _min: { salaryMin: true },
    _max: { salaryMax: true },
    _count: true,
  });

  // Same rule as the /salaries hub — a group under the sample-size floor
  // isn't shown as a "typical range", it's just noise from one or two ads.
  const bands = groups
    .filter((g) => g._count >= MIN_SALARY_SAMPLE_SIZE && g.salaryCurrency)
    .sort((a, b) => b._count - a._count);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/salaries" className="text-sm text-oxide hover:underline">← Salary guide</Link>
      <h1 className="mt-2 font-display text-3xl uppercase tracking-wide">{pretty(commodity)} salaries</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Based on live job ads posted on Orebridge — not a formal industry survey. Grouped by site type,
        currency, and pay period rather than converted or blended together.
      </p>

      {bands.length === 0 ? (
        <p className="card mt-6 text-sm text-ink/60">
          Not enough {pretty(commodity).toLowerCase()} ads with salary data yet to show a reliable range.{" "}
          <Link href={`/jobs?commodity=${commodity}`} className="underline">Browse {pretty(commodity).toLowerCase()} jobs</Link>{" "}
          directly instead.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {bands.map((b, i) => {
            const currency = b.salaryCurrency!;
            const avgMin = b._avg.salaryMin;
            const avgMax = b._avg.salaryMax;
            const suffix = periodSuffix(b.salaryPeriod);
            return (
              <div key={i} className="card">
                <p className="font-semibold">
                  {b.siteType ? pretty(b.siteType) : "All site types"}
                  <span className="ml-2 text-xs font-normal text-ink/50">
                    {b._count} ad{b._count === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="mt-1 text-lg text-patina">
                  {avgMin != null && avgMax != null
                    ? `${fmt(avgMin, currency)}–${fmt(avgMax, currency)}${suffix}`
                    : `${fmt((avgMin ?? avgMax)!, currency)}${suffix}`}
                  <span className="ml-2 text-xs font-normal text-ink/50">typical range</span>
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  Full spread across these ads: {fmt(b._min.salaryMin ?? b._max.salaryMax!, currency)}–
                  {fmt(b._max.salaryMax ?? b._min.salaryMin!, currency)}
                  {suffix}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-ink/40">
        Figures come only from ads with salary data supplied by the employer, and reflect what's currently
        live on Orebridge rather than total industry pay. They're not converted across currencies or pay
        periods, so a range shown in AUD/yr and one in USD/hr for the same commodity are deliberately kept
        separate.
      </p>
    </main>
  );
}
