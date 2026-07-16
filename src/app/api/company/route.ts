import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  website: z.string().url().nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  countryCode: z.string().length(2).nullable().optional(),
  size: z.string().trim().max(40).nullable().optional(),
  logoKey: z.string().nullable().optional(),
  kybDocumentKey: z.string().optional(), // submitting KYB moves status to PENDING
});

export async function PATCH(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { kybDocumentKey, ...fields } = parsed.data;

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  await prisma.company.update({
    where: { id: company.id },
    data: {
      ...fields,
      ...(kybDocumentKey
        ? {
            kybDocumentKey,
            verificationStatus: company.verificationStatus === "VERIFIED" ? "VERIFIED" : "PENDING",
          }
        : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
