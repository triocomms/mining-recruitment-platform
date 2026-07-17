import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/verification";

const schema = z.object({ email: z.string().email() });

/**
 * Re-send the verification email. Always responds 200 to avoid account
 * enumeration; only actually sends for existing, unverified accounts.
 * Light rate limit: a token issued <2 minutes ago won't be replaced.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  if (user && !user.deletedAt && !user.emailVerifiedAt) {
    const recentlyIssued =
      user.verifyTokenExpiresAt &&
      user.verifyTokenExpiresAt.getTime() - Date.now() > 24 * 3600 * 1000 - 2 * 60 * 1000;
    if (!recentlyIssued) {
      await sendVerificationEmail({ id: user.id, email: user.email, role: user.role });
    }
  }

  return NextResponse.json({ ok: true });
}
