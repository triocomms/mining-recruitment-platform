import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
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

  const company = await prisma.company.update({
    where: { id: parsed.data.companyId },
    data: { verificationStatus: parsed.data.status, kybNotes: parsed.data.notes },
    include: { owner: { select: { email: true } } },
  });
  if (parsed.data.status === "VERIFIED" || parsed.data.status === "REJECTED") {
    await sendEmail({
      to: company.owner.email,
      subject:
        parsed.data.status === "VERIFIED"
          ? `${company.name} is now verified on Orebridge`
          : `Your Orebridge verification was not approved`,
      body:
        parsed.data.status === "VERIFIED"
          ? `Good news — ${company.name} has passed verification. Your job ads now publish immediately and candidates will see a verified badge on your listings.`
          : `We couldn't verify ${company.name} from the documents provided.${parsed.data.notes ? `\n\nReviewer notes: ${parsed.data.notes}` : ""}\n\nYou can re-submit updated documents from your employer dashboard.`,
      template: "KYB_DECISION",
    });
  }
  await logAdminAction(
    user.id,
    `KYB_${parsed.data.status}`,
    "COMPANY",
    parsed.data.companyId,
    parsed.data.notes
  );
  return NextResponse.json({ ok: true });
}
