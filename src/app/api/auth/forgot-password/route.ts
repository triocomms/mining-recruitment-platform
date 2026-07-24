import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/verification";

const schema = z.object({ email: z.string().email() });

/**
 * Request a password reset link. Always responds 200 to avoid account
 * enumeration; only actually sends for existing, non-deleted accounts.
 * Light rate limit: a token issued <2 minutes ago won't be replaced,
 * mirroring api/auth/verify/resend/route.ts.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  if (user && !user.deletedAt) {
    const recentlyIssued =
      user.resetPasswordTokenExpiresAt &&
      user.resetPasswordTokenExpiresAt.getTime() - Date.now() > 60 * 60 * 1000 - 2 * 60 * 1000;
    if (!recentlyIssued) {
      await sendPasswordResetEmail({ id: user.id, email: user.email });
    }
  }

  return NextResponse.json({ ok: true });
}
