import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eraseUser } from "@/lib/privacy";

const schema = z.object({
  password: z.string(),
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

/** GDPR Art. 17 / CCPA deletion. Re-authenticates before erasing. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Type "DELETE MY ACCOUNT" and your password to confirm' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Password is incorrect" }, { status: 403 });
  }

  await prisma.dataRequest.create({
    data: { userId: user.id, type: "DELETE", status: "PROCESSING" },
  });
  await eraseUser(user.id);

  return NextResponse.json({ ok: true, message: "Your account and personal data have been erased." });
}
