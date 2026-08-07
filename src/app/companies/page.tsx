import Link from "next/link";
import { createElement as h } from "react";
import { Commodity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUnresolvedCountry } from "@/lib/utils";
import { stripMarkdown } from "@/lib/markdown";
import { FeaturedCompany } from "@/components/FeaturedCompany";

export const metadata = {
  title: "Mining companies",
  description:
    "Browse mining and resources employers with an active FiFoDiDo profile — commodities, open roles, and company details.",
};

export const revalidate = 60;

const pretty = (s: string | null | undefined) =>
  s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

export default async function CompaniesIndexPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const q = {
    name: typeof searchParams?.name === "string" ? searchParams.name.trim() : "",
    country: typeof searchParams?.country === "string" ? searchParams.country.trim() : "",
    commodity: typeof searchParams?.commodity === "string" ? searchParams.commodity.trim() : "",
  };

  const where: Prisma.CompanyWhereInput = {};
  if (q.name) where.name = { contains: q.name, mode: "insensitive" };
  if (q.country) where.countryCode = q.country;
  if (q.commodity) where.jobs = { some: { commodity: q.commodity as Commodity, status: "PUBLISHED" } };

  const [companies, countryRows] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: [{ name: "asc" }],
      include: {
        jobs: {
          where: { status: "PUBLISHED", commodity: { not: null } },
          select: { commodity: true },
        },
        _count: { select: { jobs: { where: { status: "PUBLISHED" } } } },
      },
    }),
    prisma.company.findMany({
      select: { countryCode: true },
      distinct: ["countryCode"],
    }),
  ]);

  const countries = countryRows
    .map((r) => r.countryCode)
    .filter((c): c is string => !isUnresolvedCountry(c))
    .sort();
  const commodities = Object.values(Commodity);
  const hasFilters = Boolean(q.name || q.country || q.commodity);

  const companyCards = companies.map((company) => {
    const commodityLabels = Array.from(
      new Set(company.jobs.map((j) => pretty(j.commodity)).filter((c): c is string => Boolean(c)))
    );
    return {
      id: company.id,
      slug: company.slug,
      name: company.name,
      logoKey: company.logoKey,
      verified: company.verificationStatus === "VERIFIED",
      countryLabel: isUnresolvedCountry(company.countryCode) ? null : company.countryCode,
      size: company.size,
      profileText: company.description ? stripMarkdown(company.description).slice(0, 180) : null,
      commodityLabels,
      jobCount: company._count.jobs,
    };
  });

  return h(
    "div",
    null,
    h(
      "div",
      {
        className:
          "relative -mx-4 mb-6 rounded-b-lg bg-gradient-to-br from-ink to-oxide-deep p-4 sm:p-6",
      },
      h("h1", { className: "font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl" }, "Mining companies"),
      h(
        "p",
        { className: "mt-1 max-w-xl text-sm text-white/80" },
        "Employers with an active profile across the global mining and resources industry — commodities, open roles and company details."
      )
    ),
    h(
      "form",
      { method: "get", className: "card grid gap-3 sm:grid-cols-4" },
      h("input", { type: "text", name: "name", placeholder: "Company name", defaultValue: q.name, className: "field" }),
      h(
        "select",
        { name: "country", defaultValue: q.country, className: "field" },
        h("option", { value: "" }, "All countries"),
        ...countries.map((c) => h("option", { key: c, value: c }, c))
      ),
      h(
        "select",
        { name: "commodity", defaultValue: q.commodity, className: "field" },
        h("option", { value: "" }, "All commodities"),
        ...commodities.map((c) => h("option", { key: c, value: c }, pretty(c)))
      ),
      h(
        "div",
        { className: "sm:col-span-4 flex items-center gap-3" },
        h("button", { type: "submit", className: "btn-primary" }, "Search"),
        hasFilters && h(Link, { href: "/companies", className: "text-sm underline" }, "Clear filters")
      )
    ),
    h(
      "p",
      { className: "mt-4 text-sm text-ink/60" },
      companyCards.length +
        " compan" +
        (companyCards.length === 1 ? "y" : "ies") +
        (hasFilters ? " matching your search." : " with an active profile.")
    ),
    hasFilters
      ? companyCards.length === 0
        ? h("p", { className: "card mt-4 text-sm text-ink/60" }, "No companies match — try broadening your search.")
        : h(
            "div",
            { className: "mt-4 grid gap-3 sm:grid-cols-2" },
            ...companyCards.map((company) =>
              h(
                Link,
                { key: company.id, href: "/companies/" + company.slug, className: "card block transition-shadow hover:shadow-md" },
                h(
                  "div",
                  { className: "flex items-center gap-3" },
                  h(
                    "div",
                    { className: "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-white" },
                    company.logoKey
                      ? h("img", {
                          src: "/api/files?key=" + encodeURIComponent(company.logoKey),
                          alt: company.name + " logo",
                          className: "h-full w-full object-contain",
                        })
                      : h("span", { className: "font-display text-lg uppercase text-ink/20" }, company.name.slice(0, 1))
                  ),
                  h(
                    "div",
                    { className: "min-w-0" },
                    h(
                      "h2",
                      { className: "font-display text-xl font-semibold leading-tight" },
                      company.name,
                      company.verified &&
                        h("span", { className: "ml-1.5 align-middle text-base text-patina", title: "Verified employer" }, "✓")
                    ),
                    h(
                      "p",
                      { className: "mt-0.5 text-sm text-ink/60" },
                      [company.countryLabel, company.size && company.size + " employees"].filter(Boolean).join(" · ")
                    )
                  )
                ),
                company.profileText && h("p", { className: "mt-3 line-clamp-2 text-sm text-ink/70" }, company.profileText),
                h(
                  "div",
                  { className: "mt-3 flex flex-wrap gap-1.5" },
                  ...company.commodityLabels.map((c) => h("span", { key: c, className: "tag !bg-oregold/40 !text-oxide-deep" }, c))
                ),
                h(
                  "p",
                  { className: "mt-2 text-xs text-ink/50" },
                  company.jobCount + " live " + (company.jobCount === 1 ? "job" : "jobs")
                )
              )
            )
          )
      : companyCards.length === 0
        ? h("p", { className: "card mt-4 text-sm text-ink/60" }, "No companies are listed yet — check back soon.")
        : h(FeaturedCompany, { companies: companyCards })
  );
}
