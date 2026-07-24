import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

/**
 * THE central privacy rule of the platform, enforced server-side only.
 *
 * A candidate profile may be viewed by:
 *  1. The candidate themself
 *  2. An ADMIN
 *  3. A verified EMPLOYER, if the profile is PUBLIC
 *  4. Any employer whose company the candidate has applied to (their
 *     application already shared their details with that company)
 *
 * Anonymous users and search engines NEVER see candidate profiles —
 * routes also send X-Robots-Tag: noindex (see next.config.mjs).
 */
export async function canViewCandidate(
  viewer: { id: string; role: Role } | null,
  candidateId: string
): Promise<boolean> {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { userId: true, visibility: true },
  });
  if (!candidate) return false;
  if (candidate.userId === viewer.id) return true;

  if (viewer.role !== "EMPLOYER") return false;

  const company = await prisma.company.findUnique({
    where: { ownerId: viewer.id },
    select: { id: true, verificationStatus: true },
  });
  if (!company || company.verificationStatus !== "VERIFIED") return false;

  if (candidate.visibility === "PUBLIC") return true;

  // PRIVATE profile: visible only where an application creates a relationship.
  const applied = await prisma.application.findFirst({
    where: { candidateId, job: { companyId: company.id }, status: { not: "WITHDRAWN" } },
    select: { id: true },
  });
  return Boolean(applied);
}

export type CandidateViewAccess = {
  allowed: boolean;
  // Why access was granted -- used by the profile page (unlike the plain
  // boolean above) to decide how much to reveal: raw email/phone only for
  // SELF/ADMIN/APPLIED, never for a cold PUBLIC-search hit, which routes
  // contact through the Message button instead. When both an application
  // AND public visibility apply, APPLIED wins so the profile page never
  // shows *less* than the applicant-pipeline list the employer came from.
  reason: "SELF" | "ADMIN" | "PUBLIC" | "APPLIED" | null;
};

export async function getCandidateViewAccess(
  viewer: { id: string; role: Role } | null,
  candidateId: string
): Promise<CandidateViewAccess> {
  const deny: CandidateViewAccess = { allowed: false, reason: null };
  if (!viewer) return deny;
  if (viewer.role === "ADMIN") return { allowed: true, reason: "ADMIN" };

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { userId: true, visibility: true },
  });
  if (!candidate) return deny;
  if (candidate.userId === viewer.id) return { allowed: true, reason: "SELF" };

  if (viewer.role !== "EMPLOYER") return deny;

  const company = await prisma.company.findUnique({
    where: { ownerId: viewer.id },
    select: { id: true, verificationStatus: true },
  });
  if (!company || company.verificationStatus !== "VERIFIED") return deny;

  const applied = await prisma.application.findFirst({
    where: { candidateId, job: { companyId: company.id }, status: { not: "WITHDRAWN" } },
    select: { id: true },
  });
  if (applied) return { allowed: true, reason: "APPLIED" };

  if (candidate.visibility === "PUBLIC") return { allowed: true, reason: "PUBLIC" };

  return deny;
}

/** Resume-database search is a Gold-tier feature on top of the rules above. */
export async function canSearchResumeDatabase(viewerId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { ownerId: viewerId },
    include: { subscription: true },
  });
  return (
    company?.verificationStatus === "VERIFIED" &&
    company.subscription?.status === "ACTIVE" &&
    company.subscription.tier === "GOLD"
  );
}
