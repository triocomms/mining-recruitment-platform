import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * Sponsored employer placement (prototype ad unit).
 * Currently picks the verified company with the most live jobs; when this
 * becomes a paid product, swap the query for a Sponsorship booking model.
 */
export async function FeaturedEmployerAd() {
  const company = await prisma.company.findFirst({
    where: { verificationStatus: "VERIFIED", jobs: { some: { status: "PUBLISHED" } } },
    orderBy: { jobs: { _count: "desc" } },
    include: {
      _count: { select: { jobs: { where: { status: "PUBLISHED" } }, followers: true } },
    },
  });
  if (!company) return null;

  return (
    <section aria-label="Sponsored employer">
      <div className="card relative overflow-hidden border-l-4 border-l-oregold">
        <div className="strata absolute inset-x-0 top-0 h-1.5" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/40">
              Sponsored · Featured employer
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold uppercase tracking-wide">
              {company.name}
              <span className="ml-2 align-middle text-base text-patina" title="Verified employer">
                ✓ Verified
              </span>
            </h2>
            {company.description && (
              <p className="mt-1 max-w-xl text-sm text-ink/70 line-clamp-2">{company.description}</p>
            )}
            <p className="mt-2 text-xs text-ink/50">
              {company._count.jobs} live {company._count.jobs === 1 ? "role" : "roles"}
              {company.countryCode && ` · ${company.countryCode}`}
              {company._count.followers > 0 && ` · ${company._count.followers} followers`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={`/companies/${company.slug}`} className="btn-primary">
              View open roles →
            </Link>
            <Link href={`/companies/${company.slug}`} className="btn-ghost hidden sm:inline-flex">
              About {company.name.split(" ")[0]}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
