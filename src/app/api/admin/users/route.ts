import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SUSPEND"),
    email: z.string().email(),
    reason: z.string().trim().min(3, "A suspension reason is required").max(1000),
  }),
  z.object({ action: z.literal("UNSUSPEND"), userId: z.string() }),
]);

/** Admin suspend/unsuspend. Distinct from GDPR erasure: reversible, no data loss. */
export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  if (d.action === "SUSPEND") {
    const user = await prisma.user.findUnique({ where: { email: d.email.toLowerCase().trim() } });
    if (!user || user.deletedAt) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.id === admin.id) return NextResponse.json({ error: "You cannot suspend yourself" }, { status: 400 });
    if (user.role === "ADMIN") return NextResponse.json({ error: "Admins cannot be suspended" }, { status: 400 });
    if (user.suspendedAt) return NextResponse.json({ error: "User is already suspended" }, { status: 400 });

    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date(), suspendedReason: d.reason },
    });
    await logAdminAction(admin.id, "USER_SUSPEND", "USER", user.id, d.reason);
    await sendEmail({
      to: user.email,
      subject: "Your Orebridge account has been suspended",
      body: `Your account has been suspended.\n\nReason: ${d.reason}\n\nIf you believe this is a mistake, reply to this email to appeal.`,
      template: "USER_SUSPENDED",
    });
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { id: d.userId } });
  if (!user || !user.suspendedAt) {
    return NextResponse.json({ error: "User is not suspended" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { suspendedAt: null, suspendedReason: null },
  });
  await logAdminAction(admin.id, "USER_UNSUSPEND", "USER", user.id);
  return NextResponse.json({ ok: true });
}
