import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { VerificationStatus } from "@prisma/client";

const schema = z.object({
  companyId: z.string(),
  status: z.nativeEnum(VerificationStatus),
  notes: z.string().max(1000).optional(),
});

/** Admin KYB review: approve or reject employer verification. */
export async function POST(req: NextRequest) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await prisma.company.update({
    where: { id: parsed.data.companyId },
    data: { verificationStatus: parsed.data.status, kybNotes: parsed.data.notes },
  });
  await logAdminAction(
    user.id,
    `KYB_${parsed.data.status}`,
    "COMPANY",
    parsed.data.companyId,
    parsed.data.notes
  );
  return NextResponse.json({ ok: true });
}
