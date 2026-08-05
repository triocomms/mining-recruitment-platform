import Link from "next/link";
import { createElement as h } from "react";
import { prisma } from "@/lib/prisma";
import { isUnresolvedCountry } from "@/lib/utils";

export const metadata = {
    title: "Mining sites",
    description:
          "Browse roster patterns, access type and camp details for mine sites across the global mining and resources industry, FIFO, DIDO and residential.",
};

export const revalidate = 300;

const pretty = (s?: string | null) =>
    s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

export default async function SitesIndexPage() {
    const sites = await prisma.miningSite.findMany({
          where: { status: "PUBLISHED" },
          orderBy: [{ countryCode: "asc" }, { name: "asc" }],
          include: {
                  _count: { select: { jobs: { where: { status: "PUBLISHED" } } } },
          },
    });

  return h(
        "div",
        null,
        h("span", { className: "rule-oxide mb-2" }),
        h("h1", { className: "font-display text-3xl font-bold uppercase tracking-tight" }, "Mining sites"),
        h(
                "p",
          { className: "mt-1 text-sm text-ink/60" },
                "Roster patterns, access type and camp details for " + sites.length + " site" + (sites.length === 1 ? "" : "s") + " across the industry."
              ),
        sites.length === 0
          ? h("p", { className: "card mt-6 text-sm text-ink/60" }, "No sites published yet, check back soon.")
          : h(
                      "div",
            { className: "mt-4 grid gap-3 sm:grid-cols-2" },
                      ...sites.map((site) =>
                                    h(
                                                    Link,
                                      { key: site.id, href: "/sites/" + site.slug, className: "card block transition-shadow hover:shadow-md" },
                                                    h("h2", { className: "font-display text-xl font-semibold leading-tight" }, site.name),
                                                    h(
                                                                      "p",
                                                      { className: "mt-0.5 text-sm text-ink/60" },
                                                                      [site.city, site.region, isUnresolvedCountry(site.countryCode) ? null : site.countryCode]
                                                                        .filter(Boolean)
                                                                        .join(", ")
                                                                    ),
                                                    h(
                                                                      "div",
                                                      { className: "mt-3 flex flex-wrap gap-1.5" },
                                                                      pretty(site.commodity) &&
                                                                        h("span", { className: "tag !bg-oregold/40 !text-oxide-deep" }, pretty(site.commodity)),
                                                                      pretty(site.accessType) &&
                                                                        h("span", { className: "tag !bg-hivis/15 !text-hivis-deep" }, pretty(site.accessType)),
                                                                      ...site.rosterPatterns.map((r: string) => h("span", { key: r, className: "tag" }, r))
                                                                    ),
                                                    h(
                                                                      "p",
                                                      { className: "mt-2 text-xs text-ink/50" },
                                                                      site._count.jobs + " live " + (site._count.jobs === 1 ? "job" : "jobs")
                                                                    )
                                                  )
                                             )
                    )
      );
}
