import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(10, "New password must be at least 10 characters"),
  });

export async function POST(req: NextRequest) {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }
    const { currentPassword, newPassword } = parsed.data;

    const record = await prisma.user.findUnique({ where: { id: user.id } });
    if (!record) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const ok = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    if (await bcrypt.compare(newPassword, record.passwordHash)) {
          return NextResponse.json({ error: "New password must be different from your current password" }, { status: 400 });
        }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  }
