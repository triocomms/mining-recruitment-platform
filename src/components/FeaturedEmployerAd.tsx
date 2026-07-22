import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isUnresolvedCountry } from "@/lib/utils";
import { stripMarkdown } from "@/lib/markdown";

/**
 * Sponsored employer placement — MREC unit (300×250, IAB medium rectangle)
 * shown beside the hero search on desktop; hidden on mobile.
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
    <aside
      aria-label="Sponsored employer"
      className="hidden lg:block"
    >
      <div className="card relative flex h-[250px] w-[300px] flex-col overflow-hidden !p-5">
        <div className="strata absolute inset-x-0 top-0 h-1.5" aria-hidden />
        <p className="pt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink/40">
          Sponsored · Featured employer
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold uppercase leading-tight tracking-wide">
          {company.name}
        </h2>
        <p className="mt-0.5 text-xs text-patina" title="Verified employer">✓ Verified employer</p>
        {company.description && (
          <p className="mt-2 text-xs leading-relaxed text-ink/70 line-clamp-3">
            {stripMarkdown(company.description)}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs text-ink/50">
            {company._count.jobs} live {company._count.jobs === 1 ? "role" : "roles"}
            {!isUnresolvedCountry(company.countryCode) && ` · ${company.countryCode}`}
          </span>
          <Link href={`/companies/${company.slug}`} className="btn-primary !px-3 !py-1.5 text-sm">
            View roles →
          </Link>
        </div>
      </div>
    </aside>
  );
}
