import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Commodity, FifoPreference, ProfileVisibility, SiteExperience, VerificationStatus } from "@prisma/client";

/**
 * Certifications and employment history are both saved as a whole-array
 * replace (see below), which would otherwise wipe out verificationStatus on
 * every unrelated profile edit. Match each incoming row against what's
 * already in the DB by documentKey — if it's the same document and nothing
 * else about the claim changed, carry the existing verification forward
 * (including VERIFIED). Otherwise this is either a brand-new upload or an
 * edited claim on an old document, and either way needs a fresh admin look,
 * so it goes to PENDING. No document at all means there's nothing to verify.
 */
function nextVerification<T extends Record<string, unknown>>(
  incoming: T & { documentKey?: string | null },
  existing: (Record<string, unknown> & { documentKey: string | null; verificationStatus: VerificationStatus; verifiedAt: Date | null; verificationNotes: string | null })[],
  fieldsToCompare: (keyof T)[]
) {
  if (!incoming.documentKey) {
    return { verificationStatus: "UNVERIFIED" as const, verifiedAt: null, verificationNotes: null };
  }
  const match = existing.find((e) => e.documentKey === incoming.documentKey);
  const unchanged = match && fieldsToCompare.every((f) => normalize(match[f as string]) === normalize(incoming[f]));
  if (match && unchanged) {
    return { verificationStatus: match.verificationStatus, verifiedAt: match.verifiedAt, verificationNotes: match.verificationNotes };
  }
  return { verificationStatus: "PENDING" as const, verifiedAt: null, verificationNotes: null };
}

/** Dates/nullish values compare unreliably by reference — flatten to a
 *  comparable primitive so a Date and its equivalent ISO string still match. */
function normalize(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toISOString();
  return String(v);
}

const schema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().max(4000).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  countryCode: z.string().length(2).nullable().optional(),
  region: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  fifoPreference: z.nativeEnum(FifoPreference).nullable().optional(),
  willingToRelocate: z.boolean().optional(),
  siteExperience: z.array(z.nativeEnum(SiteExperience)).max(8).optional(),
  commodities: z.array(z.nativeEnum(Commodity)).max(13).optional(),
  visibility: z.nativeEnum(ProfileVisibility).optional(),
  photoKey: z.string().nullable().optional(),
  resumeKey: z.string().nullable().optional(),
  resumeName: z.string().trim().max(200).nullable().optional(),
  coverLetterKey: z.string().nullable().optional(),
  coverLetterName: z.string().trim().max(200).nullable().optional(),
  availableFrom: z.string().datetime().nullable().optional(),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        issuer: z.string().trim().max(120).optional(),
        referenceNo: z.string().trim().max(80).optional(),
        expiresAt: z.string().datetime().optional(),
        documentKey: z.string().nullable().optional(),
      })
    )
    .max(40)
    .optional(),
  employmentHistory: z
    .array(
      z.object({
        companyName: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(120),
        siteType: z.nativeEnum(SiteExperience).nullable().optional(),
        commodity: z.nativeEnum(Commodity).nullable().optional(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime().nullable().optional(),
        documentKey: z.string().nullable().optional(),
      })
    )
    .max(20)
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { certifications, employmentHistory, visibility, availableFrom, ...fields } = parsed.data;

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "No profile" }, { status: 400 });

  // Switching to PUBLIC is an explicit, recorded consent event (GDPR lawful basis).
  if (visibility && visibility !== candidate.visibility) {
    await prisma.consentRecord.create({
      data: {
        userId: user.id,
        type: "PROFILE_VISIBILITY",
        granted: visibility === "PUBLIC",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0],
        userAgent: req.headers.get("user-agent"),
      },
    });
  }

  const [existingCerts, existingEmployment] = await Promise.all([
    certifications ? prisma.certification.findMany({ where: { candidateId: candidate.id } }) : Promise.resolve([]),
    employmentHistory ? prisma.employmentHistory.findMany({ where: { candidateId: candidate.id } }) : Promise.resolve([]),
  ]);

  await prisma.candidateProfile.update({
    where: { userId: user.id },
    data: {
      ...fields,
      ...(visibility ? { visibility } : {}),
      ...(availableFrom !== undefined ? { availableFrom: availableFrom ? new Date(availableFrom) : null } : {}),
      ...(certifications
        ? {
            certifications: {
              deleteMany: {},
              create: certifications.map((c) => ({
                name: c.name,
                issuer: c.issuer,
                referenceNo: c.referenceNo,
                expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
                documentKey: c.documentKey,
                ...nextVerification(c, existingCerts, ["name", "issuer", "referenceNo", "expiresAt"]),
              })),
            },
          }
        : {}),
      ...(employmentHistory
        ? {
            employmentHistory: {
              deleteMany: {},
              create: employmentHistory.map((e) => ({
                companyName: e.companyName,
                title: e.title,
                siteType: e.siteType ?? null,
                commodity: e.commodity ?? null,
                startDate: new Date(e.startDate),
                endDate: e.endDate ? new Date(e.endDate) : null,
                documentKey: e.documentKey,
                ...nextVerification(e, existingEmployment, ["companyName", "title", "siteType", "commodity", "startDate", "endDate"]),
              })),
            },
          }
        : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
