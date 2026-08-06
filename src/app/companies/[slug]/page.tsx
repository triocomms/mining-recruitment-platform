import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement as h } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JobCard } from "@/components/JobCard";
import { CompanyRatingForm } from "@/components/CompanyRatingForm";
import { RATING_CATEGORIES } from "@/lib/ratingCategories";
import { FollowCompanyButton } from "@/components/FollowCompanyButton";
import { timeAgo, isUnresolvedCountry, toVideoEmbedUrl } from "@/lib/utils";
import { renderMarkdown, stripMarkdown } from "@/lib/markdown";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const company = await prisma.company.findUnique({
          where: { slug: params.slug },
          select: { name: true, description: true },
    });
    if (!company) return { title: "Company not found -- FiFoDiDo" };
    return {
          title: `${company.name} -- jobs & news on FiFoDiDo`,
          description: company.description
            ? stripMarkdown(company.description).slice(0, 160)
                  : `Open roles at ${company.name}`,
    };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
    const company = await prisma.company.findUnique({
          where: { slug: params.slug },
          include: {
                  jobs: {
                            where: { status: "PUBLISHED" },
                            orderBy: [{ isPriority: "desc" }, { publishedAt: "desc" }],
                            include: { company: { select: { name: true, slug: true, verificationStatus: true } } },
                  },
                  blogPosts: {
                            where: { status: "PUBLISHED" },
                            orderBy: { publishedAt: "desc" },
                            take: 6,
                  },
                  _count: { select: { followers: true } },
                  ratings: {
                            select: {
                                        rosterRotation: true,
                                        accommodation: true,
                                        food: true,
                                        downtimeFacilities: true,
                                        travelLogistics: true,
                                        safetyCulture: true,
                            },
                  },
          },
    });
    if (!company) notFound();

  const ratingCount = company.ratings.length;
    const categoryAverages = RATING_CATEGORIES.map((c) => ({
          ...c,
          avg: ratingCount > 0 ? company.ratings.reduce((a, r) => a + (r as any)[c.key], 0) / ratingCount : null,
    }));
    const overallAvg =
          ratingCount > 0 ? categoryAverages.reduce((a, c) => a + (c.avg ?? 0), 0) / categoryAverages.length : null;
    const videoEmbedUrl = company.videoUrl ? toVideoEmbedUrl(company.videoUrl) : null;

  // Can the signed-in candidate rate this company? Must have reached
  // interview stage on at least one application -- not just applied -- so
  // every rating reflects an actual hiring interaction, not a drive-by.
  // Only matters when the employer has ratings switched on.
  const session = await auth();
    let raterState: {
          eligible: boolean;
          existing: {
            rosterRotation: number;
            accommodation: number;
            food: number;
            downtimeFacilities: number;
            travelLogistics: number;
            safetyCulture: number;
          } | null;
    } = { eligible: false, existing: null };
    let isFollowing = false;
    if (session?.user.role === "CANDIDATE") {
          const candidate = await prisma.candidateProfile.findUnique({ where: { userId: session.user.id } });
          if (candidate) {
                  if (company.ratingsEnabled) {
                            const interviewed = await prisma.application.findFirst({
                                        where: { candidateId: candidate.id, job: { companyId: company.id }, interviewedAt: { not: null } },
                                        select: { id: true },
                            });
                            if (interviewed) {
                                        const existing = await prisma.companyRating.findUnique({
                                                      where: { companyId_candidateId: { companyId: company.id, candidateId: candidate.id } },
                                                      select: {
                                                                      rosterRotation: true,
                                                                      accommodation: true,
                                                                      food: true,
                                                                      downtimeFacilities: true,
                                                                      travelLogistics: true,
                                                                      safetyCulture: true,
                                                      },
                                        });
                                        raterState = { eligible: true, existing };
                            }
                  }
                  const follow = await prisma.companyFollow.findUnique({
                            where: { candidateId_companyId: { candidateId: candidate.id, companyId: company.id } },
                            select: { candidateId: true },
                  });
                  isFollowing = !!follow;
          }
    }

  return h(
        "main",
    { className: "mx-auto max-w-5xl px-4 py-8" },
        h(
                "div",
          { className: "flex flex-wrap items-end justify-between gap-4" },
                h(
                          "div",
                  { className: "flex items-center gap-4" },
                          company.logoKey &&
                            h("img", {
                                          src: `/api/files?key=${encodeURIComponent(company.logoKey)}`,
                                          alt: `${company.name} logo`,
                                          className: "h-16 w-16 shrink-0 rounded-md border border-ink/10 object-contain bg-white",
                            }),
                          h(
                                      "div",
                                      null,
                                      h(
                                                    "h1",
                                        { className: "font-display text-4xl uppercase tracking-wide" },
                                                    company.name,
                                                    company.verificationStatus === "VERIFIED" &&
                                                      h("span", { className: "ml-2 align-middle text-xl text-patina", title: "Verified employer" }, "✓")
                                                  ),
                                      h(
                                                    "p",
                                        { className: "mt-1 text-sm text-ink/60" },
                                                    [
                                                                    isUnresolvedCountry(company.countryCode) ? null : company.countryCode,
                                                                    company.size && `${company.size} employees`,
                                                                  ]
                                                      .filter(Boolean)
                                                      .join(" · "),
                                                    company._count.followers > 0 &&
                                                      ` · ${company._count.followers} follower${company._count.followers === 1 ? "" : "s"}`,
                                                    company.ratingsEnabled &&
                                                      overallAvg !== null &&
                                                      h(
                                                                        "span",
                                                        { className: "ml-1.5 text-oregold", "aria-label": `Average rating ${overallAvg.toFixed(1)} of 5` },
                                                                        ` ★ ${overallAvg.toFixed(1)} (${ratingCount})`
                                                                      )
                                                  )
                                    )
                        ),
                h(
                          "div",
                  { className: "flex items-center gap-2" },
                          h(FollowCompanyButton, {
                                      companyId: company.id,
                                      following: isFollowing,
                                      viewerRole: session?.user.role ?? null,
                          }),
                          company.website &&
                            h(
                                          "a",
                              { href: company.website, target: "_blank", rel: "noreferrer nofollow", className: "btn-ghost" },
                                          "Website ↗"
                                        )
                        )
              ),

        company.description &&
          h("div", {
                    className: "mt-4 max-w-3xl text-ink/80",
                    dangerouslySetInnerHTML: { __html: renderMarkdown(company.description) },
          }),

        (videoEmbedUrl || company.galleryKeys.length > 0) &&
          h(
                    "section",
            { className: "mt-6 space-y-4" },
                    videoEmbedUrl &&
                      h(
                                    "div",
                        { className: "aspect-video w-full max-w-3xl overflow-hidden rounded-md" },
                                    h("iframe", {
                                                    src: videoEmbedUrl,
                                                    title: `${company.name} video`,
                                                    className: "h-full w-full",
                                                    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                                    allowFullScreen: true,
                                    })
                                  ),
                    company.galleryKeys.length > 0 &&
                      h(
                                    "div",
                        { className: "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" },
                                    ...company.galleryKeys.map((key) =>
                                                    h("img", {
                                                                      key,
                                                                      src: `/api/files?key=${encodeURIComponent(key)}`,
                                                                      alt: `${company.name} at work`,
                                                                      className: "aspect-square w-full rounded-md border border-ink/10 object-cover",
                                                    })
                                                                           )
                                  )
                  ),

        h("div", { className: "strata mt-8", "aria-hidden": true }),

        h(
                "section",
          { className: "mt-8" },
                h("h2", { className: "font-display text-2xl uppercase tracking-wide" }, `Open roles (${company.jobs.length})`),
                company.jobs.length === 0
                  ? h("p", { className: "card mt-3 text-sm text-ink/60" }, "No live vacancies right now.")
                  : h(
                                "div",
                    { className: "mt-3 space-y-3" },
                                ...company.jobs.map((job) => h(JobCard, { key: job.id, job }))
                              )
              ),

        company.ratingsEnabled &&
          h(
                    "section",
            { className: "mt-10" },
                    h(
                                "h2",
                      { className: "font-display text-2xl uppercase tracking-wide" },
                                `Candidate ratings${ratingCount > 0 ? ` (${ratingCount})` : ""}`
                              ),
                    overallAvg !== null &&
                      h(
                                    "p",
                        { className: "mt-1 text-sm text-ink/60" },
                                    h("span", { className: "text-oregold" }, `★ ${overallAvg.toFixed(1)}`),
                                    " average from candidates who interviewed here."
                                  ),
                    h(
                                "div",
                      { className: "mt-3 grid gap-4 lg:grid-cols-[1fr_320px]" },
                                h(
                                              "div",
                                              null,
                                              ratingCount === 0
                                                ? h(
                                                                    "p",
                                                  { className: "card text-sm text-ink/60" },
                                                                    `No ratings yet. Candidates who've interviewed with ${company.name} can leave the first one.`
                                                                  )
                                                : h(
                                                                    "div",
                                                  { className: "card space-y-2" },
                                                                    ...categoryAverages.map((c) =>
                                                                                          h(
                                                                                                                  "div",
                                                                                            { key: c.key, className: "flex items-center justify-between gap-3 text-sm" },
                                                                                                                  h("span", { className: "text-ink/70" }, c.label),
                                                                                                                  h(
                                                                                                                                            "span",
                                                                                                                    { className: "text-oregold", "aria-label": `${c.avg!.toFixed(1)} of 5` },
                                                                                                                                            `★ ${c.avg!.toFixed(1)}`
                                                                                                                                          )
                                                                                                                )
                                                                                                              ),
                                                                    h(
                                                                                          "p",
                                                                      { className: "pt-1 text-xs text-ink/50" },
                                                                                          `Based on ${ratingCount} rating${ratingCount === 1 ? "" : "s"}.`
                                                                                        )
                                                                  )
                                            ),
                                h(
                                              "div",
                                              null,
                                              raterState.eligible
                                                ? h(CompanyRatingForm, { companyId: company.id, existing: raterState.existing })
                                                : h(
                                                                    "p",
                                                  { className: "card text-xs text-ink/50" },
                                                                    "Ratings are limited to candidates who've reached at least an interview stage with this company, so every rating reflects a real hiring experience -- not just an application."
                                                                  )
                                            )
                              )
                  ),

        company.blogPosts.length > 0 &&
          h(
                    "section",
            { className: "mt-10" },
                    h("h2", { className: "font-display text-2xl uppercase tracking-wide" }, `From ${company.name}`),
                    h(
                                "div",
                      { className: "mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" },
                                ...company.blogPosts.map((p) =>
                                              h(
                                                              Link,
                                                { key: p.id, href: `/news/${p.slug}`, className: "card block" },
                                                              h("h3", { className: "font-semibold hover:underline" }, p.title),
                                                              p.excerpt && h("p", { className: "mt-1 line-clamp-3 text-sm text-ink/60" }, p.excerpt),
                                                              h("p", { className: "mt-2 text-xs text-ink/50" }, p.publishedAt ? timeAgo(p.publishedAt) : "")
                                                            )
                                                                   )
                              )
                  )
      );
}
