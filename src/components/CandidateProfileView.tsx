import { renderMarkdown } from "@/lib/markdown";
import { countryName } from "@/lib/countries";
import { formatLocation } from "@/lib/utils";
import { MessageCandidateButton } from "@/components/MessageCandidateButton";

function pretty(v: string) {
  return v.replaceAll("_", " ").toLowerCase();
}

function formatMonthYear(d: Date | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric" }).format(d);
}

export type CandidateProfileViewData = {
  id: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  summary: string | null;
  photoKey: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  yearsExperience: number | null;
  fifoPreference: string | null;
  willingToRelocate: boolean;
  availableFrom: Date | null;
  siteExperience: string[];
  commodities: string[];
  rightToWorkCountries: string[];
  resumeKey: string | null;
  resumeName: string | null;
  coverLetterKey: string | null;
  coverLetterName: string | null;
  certifications: { name: string; expiresAt: Date | null; verificationStatus: string }[];
  employmentHistory: {
    companyName: string;
    title: string;
    siteType: string | null;
    commodity: string | null;
    startDate: Date;
    endDate: Date | null;
    verificationStatus: string;
  }[];
};

/**
 * The single source of truth for "what does this candidate look like".
 * Rendered on the employer-facing profile page AND the candidate's own
 * "Preview my profile" page, so a candidate always sees exactly what a
 * verified employer would see -- never a rosier or more sparse version.
 */
export function CandidateProfileView(props: {
  profile: CandidateProfileViewData;
  email?: string | null;
  phone?: string | null;
  promoted?: boolean;
  isPreview?: boolean;
  canMessage?: boolean;
}) {
  const { profile, email, phone, promoted, isPreview, canMessage } = props;
  const location = formatLocation(profile.city, profile.region, profile.countryCode);
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div>
      {isPreview && (
        <div className="mb-6 rounded-md border border-patina/40 bg-patina/10 px-4 py-3 text-sm">
          This is exactly what verified employers see when they open your profile.
        </div>
      )}

      <div className="card flex flex-wrap items-start gap-5">
        {profile.photoKey ? (
          <img
            src={`/api/files?key=${encodeURIComponent(profile.photoKey)}`}
            alt={`${profile.firstName} ${profile.lastName}`}
            className="h-28 w-28 shrink-0 rounded-full border border-ink/10 object-cover"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-bone font-display text-3xl text-ink/40">
            {initials || "?"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl uppercase tracking-wide">
              {profile.firstName} {profile.lastName}
            </h1>
            {promoted && (
              <span className="tag bg-hivis/20 text-hivis-deep" title="This candidate has a paid promotion active">
                🚀 Promoted
              </span>
            )}
          </div>
          {profile.headline && <p className="mt-1 text-lg text-ink/80">{profile.headline}</p>}
          <p className="mt-1 text-sm text-ink/60">
            {[
              location,
              profile.yearsExperience != null && `${profile.yearsExperience} yrs experience`,
              profile.fifoPreference && pretty(profile.fifoPreference),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {profile.willingToRelocate && <p className="mt-1 text-xs text-patina">Willing to relocate</p>}
          {profile.availableFrom && (
            <p className="mt-1 text-xs text-ink/50">Available from {formatMonthYear(profile.availableFrom)}</p>
          )}

          {(email || phone) && (
            <p className="mt-2 text-sm text-ink/70">
              {email && (
                <a href={`mailto:${email}`} className="underline">
                  {email}
                </a>
              )}
              {phone && <span>{email ? " · " : ""}{phone}</span>}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {canMessage && <MessageCandidateButton candidateId={profile.id} name={profile.firstName} />}
            {profile.resumeKey && (
              <a
                href={`/api/files?key=${encodeURIComponent(profile.resumeKey)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                {profile.resumeName ?? "Resume"} ↓
              </a>
            )}
            {profile.coverLetterKey && (
              <a
                href={`/api/files?key=${encodeURIComponent(profile.coverLetterKey)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                {profile.coverLetterName ?? "Cover letter"} ↓
              </a>
            )}
          </div>
        </div>
      </div>

      {profile.summary && (
        <section className="card mt-6">
          <h2 className="font-display text-lg uppercase tracking-wide">About</h2>
          <div
            className="mt-2 max-w-none text-ink/80"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(profile.summary) }}
          />
        </section>
      )}

      {(profile.commodities.length > 0 || profile.siteExperience.length > 0) && (
        <section className="card mt-6">
          <h2 className="font-display text-lg uppercase tracking-wide">Commodities &amp; site experience</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.commodities.map((c) => (
              <span key={c} className="tag">
                {pretty(c)}
              </span>
            ))}
            {profile.siteExperience.map((s) => (
              <span key={s} className="tag bg-ink/5">
                {pretty(s)}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.employmentHistory.length > 0 && (
        <section className="card mt-6">
          <h2 className="font-display text-lg uppercase tracking-wide">Work history</h2>
          <ul className="mt-3 space-y-3">
            {profile.employmentHistory.map((h, i) => (
              <li key={i} className="border-l-2 border-ink/10 pl-3">
                <p className="font-semibold">
                  {h.title} · {h.companyName}
                  {h.verificationStatus === "VERIFIED" && (
                    <span className="ml-1.5 text-patina" title="Verified">
                      ✓
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink/50">
                  {formatMonthYear(h.startDate)} – {h.endDate ? formatMonthYear(h.endDate) : "Present"}
                  {(h.siteType || h.commodity) &&
                    ` · ${[h.siteType && pretty(h.siteType), h.commodity && pretty(h.commodity)]
                      .filter(Boolean)
                      .join(", ")}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.certifications.length > 0 && (
        <section className="card mt-6">
          <h2 className="font-display text-lg uppercase tracking-wide">Certifications &amp; tickets</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.certifications.map((c) => (
              <span key={c.name} className={`tag ${c.verificationStatus === "VERIFIED" ? "bg-patina/10" : ""}`}>
                {c.verificationStatus === "VERIFIED" ? `✓ ${c.name}` : c.name}
                {c.expiresAt && ` (exp. ${formatMonthYear(c.expiresAt)})`}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.rightToWorkCountries.length > 0 && (
        <section className="card mt-6">
          <h2 className="font-display text-lg uppercase tracking-wide">Right to work</h2>
          <p
            className="mt-2 text-sm text-ink/70"
            title="Self-declared by the candidate, not verified by FiFoDiDo -- check Certifications & tickets for supporting documents."
          >
            🛂 {profile.rightToWorkCountries.map(countryName).join(", ")}
          </p>
        </section>
      )}
    </div>
  );
}
