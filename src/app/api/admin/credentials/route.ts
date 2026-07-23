import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { VerificationStatus } from "@prisma/client";

const schema = z.object({
  kind: z.enum(["CERTIFICATION", "EMPLOYMENT_HISTORY"]),
  id: z.string(),
  status: z.nativeEnum(VerificationStatus),
  notes: z.string().max(1000).optional(),
});

/** Admin review of an uploaded certification/ticket scan or a piece of
 *  employment history proof — same approve/reject shape as company KYB. */
export async function POST(req: NextRequest) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;
  const verifiedAt = d.status === "VERIFIED" ? new Date() : null;

  if (d.kind === "CERTIFICATION") {
    const cert = await prisma.certification.update({
      where: { id: d.id },
      data: { verificationStatus: d.status, verificationNotes: d.notes, verifiedAt },
      include: { candidate: { select: { firstName: true, user: { select: { email: true } } } } },
    });
    if (d.status === "VERIFIED" || d.status === "REJECTED") {
      await sendEmail({
        to: cert.candidate.user.email,
        subject:
          d.status === "VERIFIED"
            ? `${cert.name} verified on Orebridge`
            : `We couldn't verify ${cert.name}`,
        body:
          d.status === "VERIFIED"
            ? `Good news, ${cert.candidate.firstName} — your "${cert.name}" ticket/certification is now verified and will show a verified badge to employers.`
            : `We couldn't verify "${cert.name}" from the document provided.${d.notes ? `\n\nReviewer notes: ${d.notes}` : ""}\n\nYou can upload an updated scan from your profile.`,
        template: "CREDENTIAL_DECISION",
      }).catch((e) => console.error("[admin/credentials] email failed", e));
    }
    await logAdminAction(user.id, `CERTIFICATION_${d.status}`, "CERTIFICATION", d.id, d.notes);
  } else {
    const entry = await prisma.employmentHistory.update({
      where: { id: d.id },
      data: { verificationStatus: d.status, verificationNotes: d.notes, verifiedAt },
      include: { candidate: { select: { firstName: true, user: { select: { email: true } } } } },
    });
    if (d.status === "VERIFIED" || d.status === "REJECTED") {
      await sendEmail({
        to: entry.candidate.user.email,
        subject:
          d.status === "VERIFIED"
            ? `Your role at ${entry.companyName} is now verified`
            : `We couldn't verify your role at ${entry.companyName}`,
        body:
          d.status === "VERIFIED"
            ? `Good news, ${entry.candidate.firstName} — your work history at ${entry.companyName} (${entry.title}) is now verified and will show a verified badge to employers.`
            : `We couldn't verify your role at ${entry.companyName} from the document provided.${d.notes ? `\n\nReviewer notes: ${d.notes}` : ""}\n\nYou can upload updated proof from your profile.`,
        template: "CREDENTIAL_DECISION",
      }).catch((e) => console.error("[admin/credentials] email failed", e));
    }
    await logAdminAction(user.id, `EMPLOYMENT_HISTORY_${d.status}`, "EMPLOYMENT_HISTORY", d.id, d.notes);
  }

  return NextResponse.json({ ok: true });
}
