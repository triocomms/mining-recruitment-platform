import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { resetPasswordWithToken } from "@/lib/verification";

const schema = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(10, "Password must be at least 10 characters"),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { token, newPassword } = parsed.data;

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const ok = await resetPasswordWithToken(token, passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "This reset link has expired or already been used. Request a fresh one." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
