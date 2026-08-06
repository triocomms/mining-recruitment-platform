import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const score = z.number().int().min(1).max(5);

const schema = z.object({
    companyId: z.string(),
    rosterRotation: score,
    accommodation: score,
    food: score,
    downtimeFacilities: score,
    travelLogistics: score,
    safetyCulture: score,
});

export async function POST(req: NextRequest) {
    const user = await requireUser("CANDIDATE");
    if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const d = parsed.data;

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
    if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });

  const interviewed = await prisma.application.findFirst({
        where: { candidateId: candidate.id, job: { companyId: d.companyId }, interviewedAt: { not: null } },
        select: { id: true },
  });
    if (!interviewed) {
          return NextResponse.json(
            { error: "You can only rate companies you've reached interview stage with" },
            { status: 403 }
                );
    }

  const company = await prisma.company.findUnique({ where: { id: d.companyId }, select: { ratingsEnabled: true } });
    if (!company?.ratingsEnabled) {
          return NextResponse.json({ error: "Ratings are turned off for this employer" }, { status: 403 });
    }

  const ratingData = {
        rosterRotation: d.rosterRotation,
        accommodation: d.accommodation,
        food: d.food,
        downtimeFacilities: d.downtimeFacilities,
        travelLogistics: d.travelLogistics,
        safetyCulture: d.safetyCulture,
  };

  const rating = await prisma.companyRating.upsert({
        where: { companyId_candidateId: { companyId: d.companyId, candidateId: candidate.id } },
        create: { companyId: d.companyId, candidateId: candidate.id, ...ratingData },
        update: ratingData,
  });

  return NextResponse.json({ ok: true, id: rating.id });
}
