import { prisma } from "./prisma";
import type { VerificationStatus } from "@prisma/client";
import { isUnresolvedCountry } from "./utils";

/** Shared moderation flag for any source (CSV, manual, RSS, admin approve)
 * that finds a job whose country couldn't be resolved to a real place. Kept
 * distinct from RSS's own RSS_NEEDS_FIELD_REVIEW flag (which can cover other
 * ambiguous fields too) — this one specifically blocks publish until a human
 * fixes the location. */
export const COUNTRY_NOT_DETECTED_FLAG = "COUNTRY_NOT_DETECTED";

/** True when a job's data is missing something that must never reach a
 * public page (currently: an unresolved/"ZZ" country). Any code path that's
 * about to set status to PUBLISHED — CSV import, manual creation, RSS sync,
 * or admin approve — should check this first and route to PENDING_REVIEW
 * (or refuse the approval) instead. */
export function jobHasUnresolvedFields(job: { countryCode?: string | null }): boolean {
  return isUnresolvedCountry(job.countryCode);
}

/**
 * Trust & safety rules for job ad publication.
 *
 * Trusted companies (verified + at least one prior published ad + no upheld
 * report) auto-publish. Everyone else — and anything tripping a spam
 * heuristic — lands in the PENDING_REVIEW queue for an admin decision.
 */

const PAY_TO_APPLY_RE =
  /pay(?:ing)?\s+(?:a\s+)?(?:fee\s+)?to\s+apply|application\s+fee|registration\s+fee|processing\s+fee\s+(?:is\s+)?required/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
// Phone-ish sequences. Requires a leading + / 0 / ( so salary ranges don't trip it.
const PHONE_RE = /(?:\+|\(0|\b0)[\d\s().-]{7,}\d/;
const URL_RE = /\bhttps?:\/\/|\bwww\.[\w-]+\.\w{2,}/i;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Returns a list of spam-heuristic flags. Empty array = clean. */
export async function detectSpamSignals(
  companyId: string,
  title: string,
  description: string
): Promise<string[]> {
  const flags: string[] = [];
  const text = `${title}\n${description}`;

  if (PAY_TO_APPLY_RE.test(text)) flags.push("PAY_TO_APPLY");
  if (EMAIL_RE.test(description) || PHONE_RE.test(description) || URL_RE.test(description)) {
    flags.push("OFF_PLATFORM_CONTACT");
  }

  // Near-duplicate title+description from the same company inside 24h.
  const recent = await prisma.job.findMany({
    where: { companyId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    select: { title: true, description: true },
    take: 50,
  });
  const nt = norm(title);
  const nd = norm(description).slice(0, 400);
  const dup = recent.some(
    (j) => norm(j.title) === nt || norm(j.description).slice(0, 400) === nd
  );
  if (dup) flags.push("DUPLICATE_24H");

  return flags;
}

/**
 * A company auto-publishes when it is VERIFIED, has at least one prior
 * published (or since-expired) ad, and has no upheld (RESOLVED) report
 * against it or any of its jobs.
 */
export async function companyIsTrusted(
  companyId: string,
  verificationStatus: VerificationStatus
): Promise<boolean> {
  if (verificationStatus !== "VERIFIED") return false;

  const priorPublished = await prisma.job.count({
    where: { companyId, status: { in: ["PUBLISHED", "EXPIRED"] } },
  });
  if (priorPublished < 1) return false;

  const jobs = await prisma.job.findMany({ where: { companyId }, select: { id: true } });
  const upheld = await prisma.report.count({
    where: {
      status: "RESOLVED",
      OR: [
        { targetType: "COMPANY", targetId: companyId },
        { targetType: "JOB", targetId: { in: jobs.map((j) => j.id) } },
      ],
    },
  });
  return upheld === 0;
}
