import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { commodityToSlug, MIN_SALARY_SAMPLE_SIZE } from "@/lib/utils";
import { Commodity } from "@prisma/client";
import { IndustryBenchmarks } from "@/components/IndustryBenchmarks";

export const metadata = {
  title: "Mining & resources salary guide",
  description:
    "Typical pay ranges for mining and resources roles, by commodity, based on live job ads on FiFoDiDo.",
};
export const revalidate = 3600;

const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function SalariesPage() {
  const counts = await prisma.job.groupBy({
    by: ["commodity"],
    where: {
      status: "PUBLISHED",
      commodity: { not: null },
      OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
    },
    _count: true,
  });
  const countByCommodity = new Map(counts.map((c) => [c.commodity, c._count]));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Mining & resources salary guide</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Typical pay ranges by commodity, drawn from live job ads posted on FiFoDiDo — not a formal industry
        survey. Figures are shown separately by currency and pay period rather than converted, and only once
        there are enough ads to be meaningful.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Object.values(Commodity).map((c) => {
          const count = countByCommodity.get(c) ?? 0;
          const enough = count >= MIN_SALARY_SAMPLE_SIZE;
          return enough ? (
            <Link key={c} href={`/salaries/${commodityToSlug(c)}`} className="card block hover:shadow-md">
              <p className="font-semibold">{pretty(c)}</p>
              <p className="mt-1 text-xs text-ink/50">{count} live job ad{count === 1 ? "" : "s"} with salary data</p>
            </Link>
          ) : (
            <div key={c} className="card text-ink/40">
              <p className="font-semibold">{pretty(c)}</p>
              <p className="mt-1 text-xs">Not enough data yet</p>
            </div>
          );
        })}
      </div>

      <div className="strata mt-8" aria-hidden />
      <IndustryBenchmarks />
    </main>
  );
}
