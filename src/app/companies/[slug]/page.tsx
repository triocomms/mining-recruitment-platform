import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JobCard } from "@/components/JobCard";
import { ReviewForm } from "@/components/ReviewForm";
import { FollowCompanyButton } from "@/components/FollowCompanyButton";
import { timeAgo, isUnresolvedCountry, toVideoEmbedUrl } from "@/lib/utils";
import { renderMarkdown, stripMarkdown } from "@/lib/markdown";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true },
  });
  if (!company) return { title: "Company not found — Orebridge" };
  return {
    title: `${company.name} — jobs & news on Orebridge`,
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
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { candidate: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!company) notFound();

  const avgRating =
    company.reviews.length > 0
      ? company.reviews.reduce((a, r) => a + r.rating, 0) / company.reviews.length
      : null;
  const videoEmbedUrl = company.videoUrl ? toVideoEmbedUrl(company.videoUrl) : null;

  // Can the signed-in candidate review this company? Must have reached
  // interview stage on at least one application — not just applied — so
  // every review reflects an actual hiring interaction, not a drive-by.
  const session = await auth();
  let reviewerState: { eligible: boolean; existing: { rating: number; title: string | null; body: string } | null } = { eligible: false, existing: null };
  let isFollowing = false;
  if (session?.user.role === "CANDIDATE") {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId: session.user.id } });
    if (candidate) {
      const interviewed = await prisma.application.findFirst({
        where: { candidateId: candidate.id, job: { companyId: company.id }, interviewedAt: { not: null } },
        select: { id: true },
      });
      if (interviewed) {
        const existing = await prisma.companyReview.findUnique({
          where: { companyId_candidateId: { companyId: company.id, candidateId: candidate.id } },
          select: { rating: true, title: true, body: true },
        });
        reviewerState = { eligible: true, existing };
      }
      const follow = await prisma.companyFollow.findUnique({
        where: { candidateId_companyId: { candidateId: candidate.id, companyId: company.id } },
        select: { candidateId: true },
      });
      isFollowing = !!follow;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {company.logoKey && (
            <img
              src={`/api/files?key=${encodeURIComponent(company.logoKey)}`}
              alt={`${company.name} logo`}
              className="h-16 w-16 shrink-0 rounded-md border border-ink/10 object-contain bg-white"
            />
          )}
          <div>
            <h1 className="font-display text-4xl uppercase tracking-wide">
              {company.name}
              {company.verificationStatus === "VERIFIED" && (
                <span className="ml-2 align-middle text-xl text-patina" title="Verified employer">✓</span>
              )}
            </h1>
            <p className="mt-1 text-sm text-ink/60">
            {[
              isUnresolvedCountry(company.countryCode) ? null : company.countryCode,
              company.size && `${company.size} employees`,
            ].filter(Boolean).join(" · ")}
            {company._count.followers > 0 && ` · ${company._count.followers} follower${company._count.followers === 1 ? "" : "s"}`}
            {avgRating !== null && (
              <span className="ml-1.5 text-oregold" aria-label={`Average rating ${avgRating.toFixed(1)} of 5`}>
                ★ {avgRating.toFixed(1)} ({company.reviews.length})
              </span>
            )}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FollowCompanyButton companyId={company.id} following={isFollowing} viewerRole={session?.user.role ?? null} />
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer nofollow" className="btn-ghost">
              Website ↗
            </a>
          )}
        </div>
      </div>

      {company.description && (
        <div
          className="mt-4 max-w-3xl text-ink/80"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(company.description) }}
        />
      )}

      {(videoEmbedUrl || company.galleryKeys.length > 0) && (
        <section className="mt-6 space-y-4">
          {videoEmbedUrl && (
            <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-md">
              <iframe
                src={videoEmbedUrl}
                title={`${company.name} video`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {company.galleryKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {company.galleryKeys.map((key) => (
                <img
                  key={key}
                  src={`/api/files?key=${encodeURIComponent(key)}`}
                  alt={`${company.name} at work`}
                  className="aspect-square w-full rounded-md border border-ink/10 object-cover"
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="strata mt-8" aria-hidden />

      <section className="mt-8">
        <h2 className="font-display text-2xl uppercase tracking-wide">
          Open roles ({company.jobs.length})
        </h2>
        {company.jobs.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No live vacancies right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {company.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl uppercase tracking-wide">
          Candidate reviews{company.reviews.length > 0 ? ` (${company.reviews.length})` : ""}
        </h2>
        {avgRating !== null && (
          <p className="mt-1 text-sm text-ink/60">
            <span className="text-oregold">★ {avgRating.toFixed(1)}</span> average from candidates who interviewed here.
          </p>
        )}
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            {company.reviews.length === 0 ? (
              <p className="card text-sm text-ink/60">
                No reviews yet. Candidates who've interviewed with {company.name} can leave the first one.
              </p>
            ) : (
              <ul className="space-y-3">
                {company.reviews.map((r) => (
                  <li key={r.id} className="card text-sm">
                    <p className="text-oregold" aria-label={`${r.rating} of 5 stars`}>
                      {"★".repeat(r.rating)}
                      <span className="text-ink/15">{"★".repeat(5 - r.rating)}</span>
                    </p>
                    {r.title && <p className="mt-1 font-semibold">{r.title}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-ink/80">{r.body}</p>
                    <p className="mt-2 text-xs text-ink/50">
                      {r.candidate.firstName} {r.candidate.lastName.slice(0, 1)}. · {timeAgo(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            {reviewerState.eligible ? (
              <ReviewForm companyId={company.id} existing={reviewerState.existing} />
            ) : (
              <p className="card text-xs text-ink/50">
                Reviews are limited to candidates who've reached at least an interview stage with this
                company, so every rating reflects a real hiring experience — not just an application.
              </p>
            )}
          </div>
        </div>
      </section>

      {company.blogPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl uppercase tracking-wide">From {company.name}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.blogPosts.map((p) => (
              <Link key={p.id} href={`/news/${p.slug}`} className="card block">
                <h3 className="font-semibold hover:underline">{p.title}</h3>
                {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-ink/60">{p.excerpt}</p>}
                <p className="mt-2 text-xs text-ink/50">{p.publishedAt ? timeAgo(p.publishedAt) : ""}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
