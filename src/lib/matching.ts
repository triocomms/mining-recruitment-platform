import type { CandidateProfile, Certification, Job } from "@prisma/client";
import { stripMarkdown } from "@/lib/markdown";

/**
 * Weighted candidate↔job matching (v1 — no ML, transparent scoring).
 *
 * Dimensions and weights:
 *   commodity match        30
 *   site experience match  30
 *   certifications/tickets 20 (keyword overlap with the job text)
 *   FIFO/roster fit        20
 * Score is normalized to 0–100. Explanations are returned so employers see
 * WHY someone ranked where they did.
 */

export type MatchInput = {
  candidate: Pick<
    CandidateProfile,
    "commodities" | "siteExperience" | "fifoPreference" | "yearsExperience" | "countryCode" | "region"
  > & { certifications: Pick<Certification, "name" | "expiresAt">[] };
  job: Pick<
    Job,
    "commodity" | "siteType" | "fifo" | "rosterPattern" | "title" | "description" | "countryCode" | "region"
  >;
};

export type MatchResult = { score: number; reasons: string[] };

const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ");

export function scoreMatch({ candidate, job }: MatchInput): MatchResult {
  let score = 0;
  let possible = 0;
  const reasons: string[] = [];

  // Commodity (30)
  if (job.commodity) {
    possible += 30;
    if (candidate.commodities.includes(job.commodity)) {
      score += 30;
      reasons.push(`${pretty(job.commodity)} experience`);
    }
  }

  // Site type (30)
  if (job.siteType) {
    possible += 30;
    if (candidate.siteExperience.includes(job.siteType)) {
      score += 30;
      reasons.push(`${pretty(job.siteType)} site experience`);
    }
  }

  // Certifications / tickets (20): overlap between cert names and job text.
  // An expired ticket isn't a real qualification match, so it's excluded —
  // same rule ProfileForm already uses to visually flag expired certs.
  const validCerts = candidate.certifications.filter(
    (c) => !c.expiresAt || c.expiresAt.getTime() >= Date.now()
  );
  if (validCerts.length > 0) {
    possible += 20;
    // stripMarkdown() so a cert name spanning a **bold**/[link](url) boundary
    // in the raw source still matches as a contiguous phrase.
    const jobText = `${job.title} ${stripMarkdown(job.description)}`.toLowerCase();
    const hits = validCerts.filter((c) => {
      const name = c.name.toLowerCase().trim();
      return name.length >= 3 && jobText.includes(name);
    });
    if (hits.length > 0) {
      score += Math.min(20, hits.length * 10);
      reasons.push(`holds ${hits.map((h) => h.name).join(", ")}`);
    }
  }

  // FIFO / roster fit (20)
  possible += 20;
  const pref = candidate.fifoPreference;
  if (job.fifo) {
    if (pref === "FIFO" || pref === "DIDO") {
      score += 20;
      reasons.push("wants FIFO/DIDO rosters");
    } else if (pref === "FLEXIBLE" || pref === null) {
      score += 10;
    }
  } else {
    if (pref === "RESIDENTIAL") {
      score += 20;
      reasons.push("prefers residential roles");
    } else if (pref === "FLEXIBLE" || pref === null) {
      score += 10;
    }
  }

  // Small location bonus (not weighted into `possible` — a tiebreaker).
  if (job.countryCode && candidate.countryCode === job.countryCode) {
    score += 3;
    if (job.region && candidate.region && candidate.region.toLowerCase() === job.region.toLowerCase()) {
      score += 3;
      reasons.push(`based in ${candidate.region}`);
    }
  }

  const normalized = possible > 0 ? Math.min(100, Math.round((score / possible) * 100)) : 0;
  return { score: normalized, reasons };
}
