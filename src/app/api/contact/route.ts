import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";

/**
 * Public "Contact us" form submission (see /contact and ContactForm.tsx).
 * Unauthenticated by design -- anyone should be able to reach the site,
 * candidate or employer or neither. Anti-spam is the same Cloudflare
 * Turnstile check already used on /api/register (fails open until
 * TURNSTILE_SECRET_KEY is configured, fails closed only on an explicit
 * "invalid token" from Cloudflare).
 *
 * Every submission notifies mcdougall6@gmail.com by email with a link
 * to the admin detail page -- replies are sent from there, from the
 * platform's own address, never from that personal inbox directly.
 */
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().email(),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
  turnstileToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;

  const turnstileCheck = await verifyTurnstileToken(d.turnstileToken, ip);
  if (!turnstileCheck.ok) {
    return NextResponse.json({ error: turnstileCheck.reason }, { status: 400 });
  }

  const contactMessage = await prisma.contactMessage.create({
    data: {
      name: d.name,
      email: d.email.toLowerCase().trim(),
      subject: d.subject,
      message: d.message,
      ipAddress: ip,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const adminLink = `${appUrl}/dashboard/admin/contact/${contactMessage.id}`;

  // Best-effort: a notification failure must never fail the visitor's
  // submission -- the message is already safely stored either way.
  await sendEmail({
    to: "mcdougall6@gmail.com",
    subject: `New contact form message: ${d.subject}`,
    body: `${d.name} <${d.email}> sent a message via the Contact Us form:\n\n${d.message}\n\nRead and reply on the site:\n${adminLink}`,
    template: "CONTACT_MESSAGE",
  }).catch((e) => console.error("[contact] notification email failed", e));

  return NextResponse.json({ ok: true }, { status: 201 });
}
