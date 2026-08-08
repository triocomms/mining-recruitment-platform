import { prisma } from "@/lib/prisma";

/**
 * Admin-managed homepage banner — image + click-through link, edited at
 * /dashboard/admin/homepage-ad (see HomepageAdForm.tsx). Occupies the same
 * hero-adjacent slot the earlier auto-generated "Sponsored employer"
 * placement (FeaturedEmployerAd.tsx, gated off via FEATURES.featuredEmployerAd)
 * used to sit in, but is now a real ad an admin controls directly rather
 * than something computed from company data.
 */
export async function HomepageBannerAd() {
  const ad = await prisma.homepageAd.findUnique({ where: { id: "homepage-ad" } });
  if (!ad?.enabled || !ad.imageKey || !ad.linkUrl) return null;

  return (
    <aside aria-label="Advertisement" className="hidden shrink-0 lg:block">
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="card block h-[250px] w-[300px] overflow-hidden !p-0"
      >
        <img
          src={`/api/files?key=${encodeURIComponent(ad.imageKey)}`}
          alt="Advertisement"
          className="h-full w-full object-cover"
        />
      </a>
    </aside>
  );
}
