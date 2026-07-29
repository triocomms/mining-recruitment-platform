import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";

const schema = z.object({ reply: z.string().min(3).max(5000) });

/**
 * Admin reply to a public Contact Us submission. Always sends from the
 * platform's own address via Resend (src/lib/email.ts) - never a personal
 * inbox - so the whole exchange stays visible to any admin, not just
 * whoever replied. Only marks the message REPLIED if the email actually
 * sent; a failed send leaves it NEW so it isn't silently lost.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const message = await prisma.contactMessage.findUnique({ where: { id: params.id } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const result = await sendEmail({
    to: message.email,
    subject: `Re: ${message.subject}`,
    body: parsed.data.reply,
    template: "CONTACT_REPLY",
  });

  if (result.ok) {
    await prisma.contactMessage.update({
      where: { id: message.id },
      data: {
        adminReply: parsed.data.reply,
        repliedById: admin.id,
        repliedAt: new Date(),
        status: "REPLIED",
      },
    });
  }

  await logAdminAction(admin.id, "CONTACT_REPLY", "CONTACT_MESSAGE", message.id, result.error);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
