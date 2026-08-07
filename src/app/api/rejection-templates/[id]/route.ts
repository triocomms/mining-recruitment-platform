import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
}).refine((d) => d.name !== undefined || d.body !== undefined, { message: "Nothing to update" });

async function loadOwnedTemplate(userId: string, id: string) {
  const company = await prisma.company.findUnique({ where: { ownerId: userId } });
  if (!company) return { error: NextResponse.json({ error: "No company profile" }, { status: 400 }) } as const;

  const template = await prisma.rejectionTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== company.id) {
    return { error: NextResponse.json({ error: "Template not found" }, { status: 404 }) } as const;
  }
  return { template } as const;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const lookup = await loadOwnedTemplate(user.id, params.id);
  if ("error" in lookup) return lookup.error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const template = await prisma.rejectionTemplate.update({
    where: { id: params.id },
    data: { ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}), ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}) },
  });
  return NextResponse.json({ template });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const lookup = await loadOwnedTemplate(user.id, params.id);
  if ("error" in lookup) return lookup.error;

  await prisma.rejectionTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
