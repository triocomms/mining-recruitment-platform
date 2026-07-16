import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Commodity, FifoPreference, ProfileVisibility, SiteExperience } from "@prisma/client";

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
  coverLetterKey: z.string().nullable().optional(),
  certifications: z
    .array(z.object({ name: z.string().trim().min(1).max(120), issuer: z.string().trim().max(120).optional(), expiresAt: z.string().datetime().optional() }))
    .max(40)
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { certifications, visibility, ...fields } = parsed.data;

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

  await prisma.candidateProfile.update({
    where: { userId: user.id },
    data: {
      ...fields,
      ...(visibility ? { visibility } : {}),
      ...(certifications
        ? {
            certifications: {
              deleteMany: {},
              create: certifications.map((c) => ({
                name: c.name,
                issuer: c.issuer,
                expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
              })),
            },
          }
        : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
