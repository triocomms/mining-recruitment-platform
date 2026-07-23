import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueEmailChangeToken, sendEmailChangeConfirmation } from "@/lib/verification";

const schema = z.object({
    newEmail: z.string().email(),
    currentPassword: z.string().min(1, "Enter your current password"),
  });

export async function POST(req: NextRequest) {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }
    const newEmail = parsed.data.newEmail.toLowerCase().trim();

    const record = await prisma.user.findUnique({ where: { id: user.id } });
    if (!record) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const ok = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    if (newEmail === record.email) {
          return NextResponse.json({ error: "That's already your current email" }, { status: 400 });
        }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) return NextResponse.json({ error: "Another account already uses this email" }, { status: 409 });

    const raw = await issueEmailChangeToken(user.id, newEmail);
    await sendEmailChangeConfirmation(record.email, newEmail, raw);

    return NextResponse.json({ ok: true, pendingEmail: newEmail });
  }

export async function DELETE() {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    await prisma.user.update({
          where: { id: user.id },
          data: { pendingEmail: null, pendingEmailTokenHash: null, pendingEmailTokenExpiresAt: null },
        });

    return NextResponse.json({ ok: true });
  }
