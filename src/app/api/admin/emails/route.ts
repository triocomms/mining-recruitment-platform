import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resendFromLog } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";

const schema = z.object({ emailLogId: z.string() });

/** Resend a logged transactional email. */
export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await resendFromLog(parsed.data.emailLogId);
  await logAdminAction(admin.id, "EMAIL_RESEND", "USER", parsed.data.emailLogId, result.error);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
