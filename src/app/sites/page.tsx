import Link from "next/link";
import { createElement as h } from "react";
import { prisma } from "@/lib/prisma";
import { isUnresolvedCountry } from "@/lib/utils";

export const metadata = {
    title: "Mining sites",
    description:
        "Browse roster patterns, access type and camp details for mine sites across the global mining and resources industry, FIFO, DIDO and residential.",
};

export const revalidate = 60;

const pretty = (s) =>
    s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

export default async function SitesIndexPage({ searchParams }) {
    const q = {
        name: typeof searchParams?.name === "string" ? searchParams.name.trim() : "",
        company: typeof searchParams?.company === "string" ? searchParams.company.trim() : "",
        country: typeof searchParams?.country === "string" ? searchParams.country.trim() : "",
        region: typeof searchParams?.region === "string" ? searchParams.region.trim() : "",
    };

const where = { status: "PUBLISHED" };
    if (q.name) where.name = { contains: q.name, mode: "insensitive" };
    if (q.region) where.region = { contains: q.region, mode: "insensitive" };
    if (q.country) where.countryCode = q.country;
    if (q.company) where.operatorCompany = { name: { contains: q.company, mode: "insensitive" } };

const [sites, countryRows] = await Promise.all([
    prisma.miningSite.findMany({
        where,
        orderBy: [{ countryCode: "asc" }, { name: "asc" }],
        include: {
            _count: { select: { jobs: { where: { status: "PUBLISHED" } } } },
            operatorCompany: { select: { name: true, slug: true } },
        },
    }),
    prisma.miningSite.findMany({
        where: { status: "PUBLISHED" },
        select: { countryCode: true },
        distinct: ["countryCode"],
    }),
    ]);

const countries = countryRows
    .map((r) => r.countryCode)
    .filter((c) => !isUnresolvedCountry(c))
    .sort();
    const hasFilters = Boolean(q.name || q.company || q.country || q.region);

return h(
    "div",
    null,
    h(
        "div",
        { className: "relative -mx-4 mb-6 h-56 overflow-hidden sm:h-72 sm:rounded-b-lg" },
        h("img", {
            src: "/sites-hero.jpg",
                                                alt: "Mine camp accommodation in the outback",
            className: "h-full w-full object-cover",
        }),
        h("div", { className: "absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" }),
        h(
            "div",
            { className: "absolute inset-x-0 bottom-0 p-4 sm:p-6" },
            h("h1", { className: "font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl" }, "Mining sites"),
            h(
                "p",
                { className: "mt-1 max-w-xl text-sm text-white/80" },
                "Roster patterns, access type and camp details for mine sites across the global mining and resources industry."
                )
            )
        ),
    h(
        "form",
        { method: "get", className: "card grid gap-3 sm:grid-cols-4" },
        h("input", { type: "text", name: "name", placeholder: "Site name", defaultValue: q.name, className: "field" }),
        h("input", { type: "text", name: "company", placeholder: "Company", defaultValue: q.company, className: "field" }),
        h("input", { type: "text", name: "region", placeholder: "State / region", defaultValue: q.region, className: "field" }),
        h(
            "select",
            { name: "country", defaultValue: q.country, className: "field" },
            h("option", { value: "" }, "All countries"),
            ...countries.map((c) => h("option", { key: c, value: c }, c))
            ),
        h(
            "div",
            { className: "sm:col-span-4 flex items-center gap-3" },
            h("button", { type: "submit", className: "btn-primary" }, "Search"),
            hasFilters && h(Link, { href: "/sites", className: "text-sm underline" }, "Clear filters")
            )
        ),
    h(
        "p",
    { className: "mt-4 text-sm text-ink/60" },
        sites.length + " site" + (sites.length === 1 ? "" : "s") + (hasFilters ? " matching your search." : " across the industry.")
        ),
    sites.length === 0
    ? h("p", { className: "card mt-4 text-sm text-ink/60" }, "No sites match \u2014 try broadening your search.")
    : h(
        "div",
        { className: "mt-4 grid gap-3 sm:grid-cols-2" },
        ...sites.map((site) =>
            h(
                Link,
                { key: site.id, href: "/sites/" + site.slug, className: "card block transition-shadow hover:shadow-md" },
                site.heroImageKey &&
                h("img", {
                    src: "/api/files?key=" + encodeURIComponent(site.heroImageKey),
                    alt: "",
                    className: "mb-3 h-32 w-full rounded-md object-cover",
                }),
                h("h2", { className: "font-display text-xl font-semibold leading-tight" }, site.name),
                site.operatorCompany && h("p", { className: "text-xs text-ink/50" }, site.operatorCompany.name),
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
                    ...site.rosterPatterns.map((r) => h("span", { key: r, className: "tag" }, r))
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
