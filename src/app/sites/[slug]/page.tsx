import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement as h } from "react";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { isUnresolvedCountry } from "@/lib/utils";

export const revalidate = 300;

const pretty = (s?: string | null) =>
    s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

function locationOf(site: { city: string | null; region: string | null; countryCode: string }) {
    return [site.city, site.region, isUnresolvedCountry(site.countryCode) ? null : site.countryCode]
      .filter(Boolean)
      .join(", ");
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const site = await prisma.miningSite.findUnique({
          where: { slug: params.slug },
          select: { name: true, city: true, region: true, countryCode: true, status: true },
    });
    if (!site || site.status !== "PUBLISHED") {
          return { title: "Site not found, FiFoDiDo", robots: { index: false, follow: false } };
    }
    const location = locationOf(site);
    return {
          title: site.name + ", mine site profile",
          description:
                  "Roster patterns, access type and camp details for " + site.name + (location ? " (" + location + ")" : "") + ", plus live vacancies.",
    };
}

export default async function SitePage({ params }: { params: { slug: string } }) {
    const site = await prisma.miningSite.findUnique({
          where: { slug: params.slug },
          include: {
                  jobs: {
                            where: { status: "PUBLISHED" },
                            orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
                            include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
                  },
          },
    });
    if (!site || site.status !== "PUBLISHED") notFound();

  const location = locationOf(site);
    const campDetails = [
          site.roomType,
          site.wifiNotes,
          site.gym ? "Gym" : null,
          site.pool ? "Pool" : null,
          site.foodNotes,
          site.otherAmenities,
        ].filter(Boolean);
    const hasLogisticsDetail =
          site.pointsOfHire.length > 0 || site.charterOriginCities.length > 0 || Boolean(site.driveTimeFromTown) || campDetails.length > 0;

  return h(
        "main",
    { className: "mx-auto max-w-5xl px-4 py-8" },
        h(
                "p",
          { className: "text-sm text-ink/60" },
                h(Link, { href: "/sites", className: "hover:underline" }, "All mining sites")
              ),
        h("h1", { className: "mt-1 font-display text-4xl uppercase tracking-wide" }, site.name),
        location && h("p", { className: "mt-1 text-sm text-ink/60" }, location),
        h(
                "div",
          { className: "mt-3 flex flex-wrap gap-1.5" },
                pretty(site.commodity) && h("span", { className: "tag !bg-oregold/40 !text-oxide-deep" }, pretty(site.commodity)),
                pretty(site.accessType) && h("span", { className: "tag !bg-hivis/15 !text-hivis-deep" }, pretty(site.accessType)),
                ...site.rosterPatterns.map((r: string) => h("span", { key: r, className: "tag" }, r))
              ),
        h(
                "div",
          { className: "card mt-6 space-y-2" },
                h("h2", { className: "font-display text-lg uppercase tracking-wide" }, "Roster and logistics"),
                site.pointsOfHire.length > 0 &&
                  h("p", { className: "text-sm text-ink/70" }, "Point of hire: " + site.pointsOfHire.join(", ")),
                site.charterOriginCities.length > 0 &&
                  h("p", { className: "text-sm text-ink/70" }, "Charter from: " + site.charterOriginCities.join(", ")),
                site.driveTimeFromTown && h("p", { className: "text-sm text-ink/70" }, site.driveTimeFromTown),
                campDetails.length > 0 && h("p", { className: "text-sm text-ink/70" }, campDetails.join(" / ")),
                !hasLogisticsDetail && h("p", { className: "text-sm text-ink/50" }, "No further logistics details on file yet.")
              ),
        h(
                "section",
          { className: "mt-10" },
                h(
                          "h2",
                  { className: "font-display text-2xl uppercase tracking-wide" },
                          "Live vacancies at " + site.name + " (" + site.jobs.length + ")"
                        ),
                site.jobs.length === 0
                  ? h("p", { className: "card mt-3 text-sm text-ink/60" }, "No live vacancies at this site right now.")
                  : h(
                                "div",
                    { className: "mt-3 space-y-3" },
                                ...site.jobs.map((job: any) => h(JobCard, { key: job.id, job }))
                              )
              )
      );
}
