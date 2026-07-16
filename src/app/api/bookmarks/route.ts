import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ jobId: z.string() });

/** Toggle a job bookmark for the signed-in candidate. */
export async function POST(req: NextRequest) {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const where = { candidateId_jobId: { candidateId: candidate.id, jobId: parsed.data.jobId } };
  const existing = await prisma.jobBookmark.findUnique({ where });
  if (existing) {
    await prisma.jobBookmark.delete({ where });
    return NextResponse.json({ bookmarked: false });
  }
  await prisma.jobBookmark.create({ data: { candidateId: candidate.id, jobId: parsed.data.jobId } });
  return NextResponse.json({ bookmarked: true });
}
