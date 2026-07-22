import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Commodity, SiteExperience, AlertFrequency } from "@prisma/client";

const MAX_SAVED_SEARCHES = 10;

const createSchema = z.object({
  label: z.string().trim().max(80).optional(),
  commodity: z.nativeEnum(Commodity).optional(),
  siteType: z.nativeEnum(SiteExperience).optional(),
  countryCode: z.string().length(2).optional(),
  fifoOnly: z.boolean().optional(),
  minSalary: z.number().int().positive().optional(),
  frequency: z.nativeEnum(AlertFrequency).optional(),
});

export async function GET() {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });

  const searches = await prisma.savedSearch.findMany({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ searches });
}

export async function POST(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const d = parsed.data;
  if (!d.commodity && !d.siteType && !d.countryCode && !d.fifoOnly && !d.minSalary) {
    return NextResponse.json({ error: "Add at least one filter before saving a search" }, { status: 400 });
  }

  const existingCount = await prisma.savedSearch.count({ where: { candidateId: candidate.id } });
  if (existingCount >= MAX_SAVED_SEARCHES) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_SAVED_SEARCHES} searches — delete one first` },
      { status: 400 }
    );
  }

  const search = await prisma.savedSearch.create({
    data: {
      candidateId: candidate.id,
      label: d.label,
      commodity: d.commodity,
      siteType: d.siteType,
      countryCode: d.countryCode?.toUpperCase(),
      fifoOnly: d.fifoOnly ?? false,
      minSalary: d.minSalary,
      frequency: d.frequency ?? "DAILY",
    },
  });
  return NextResponse.json({ id: search.id }, { status: 201 });
}

const patchSchema = z.object({ id: z.string(), frequency: z.nativeEnum(AlertFrequency) });

/** Change an existing saved search's alert frequency (daily/weekly). */
export async function PATCH(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  // Scoped by candidateId as well as id, same "update if mine" guard used
  // by DELETE below.
  const updated = await prisma.savedSearch.updateMany({
    where: { id: parsed.data.id, candidateId: candidate.id },
    data: { frequency: parsed.data.frequency },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Candidate account required" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "No profile" }, { status: 400 });

  // Scoped delete by candidateId as well as id — deleteMany here is really a
  // "delete if mine" guard, not a bulk operation.
  const deleted = await prisma.savedSearch.deleteMany({ where: { id, candidateId: candidate.id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
