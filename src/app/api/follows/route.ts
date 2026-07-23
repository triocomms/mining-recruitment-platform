import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ companyId: z.string() });

export async function POST(req: NextRequest) {
    const user = await requireUser("CANDIDATE");
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
    if (!candidate) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const where = { candidateId_companyId: { candidateId: candidate.id, companyId: parsed.data.companyId } };
    const existing = await prisma.companyFollow.findUnique({ where });
    if (existing) {
          await prisma.companyFollow.delete({ where });
          return NextResponse.json({ following: false });
    }
    await prisma.companyFollow.create({ data: { candidateId: candidate.id, companyId: parsed.data.companyId } });
    return NextResponse.json({ following: true });
}
