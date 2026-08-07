import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
});

/** List the caller's own canned rejection templates, newest first. */
export async function GET() {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const templates = await prisma.rejectionTemplate.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const template = await prisma.rejectionTemplate.create({
    data: { companyId: company.id, name: parsed.data.name, body: parsed.data.body },
  });
  return NextResponse.json({ template }, { status: 201 });
}
