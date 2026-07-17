import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";
import { sendVerificationEmail } from "@/lib/verification";

const schema = z.object({
  role: z.enum(["CANDIDATE", "EMPLOYER"]), // ADMIN is never self-service
  email: z.string().email(),
  password: z.string().min(10, "Password must be at least 10 characters"),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  companyName: z.string().trim().min(2).max(120).optional(),
  countryCode: z.string().length(2).optional(),
  // Privacy-by-design: consent is captured at the moment of registration.
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: "You must accept the privacy policy" }) }),
  marketingOptIn: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;
  const email = d.email.toLowerCase().trim();

  if (d.role === "CANDIDATE" && (!d.firstName || !d.lastName)) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }
  if (d.role === "EMPLOYER" && !d.companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  const ua = req.headers.get("user-agent");
  const passwordHash = await bcrypt.hash(d.password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: d.role,
      consents: {
        create: [
          { type: "TERMS", granted: true, ipAddress: ip, userAgent: ua },
          { type: "PRIVACY_POLICY", granted: true, ipAddress: ip, userAgent: ua },
          { type: "MARKETING_EMAIL", granted: d.marketingOptIn, ipAddress: ip, userAgent: ua },
        ],
      },
      ...(d.role === "CANDIDATE"
        ? {
            candidate: {
              create: {
                firstName: d.firstName!,
                lastName: d.lastName!,
                countryCode: d.countryCode,
                visibility: "PRIVATE", // private by default, always
              },
            },
          }
        : {
            company: {
              create: { name: d.companyName!, slug: makeSlug(d.companyName!), countryCode: d.countryCode },
            },
          }),
    },
  });

  // Account is inactive until the email is verified.
  await sendVerificationEmail({ id: user.id, email: user.email, role: user.role });

  return NextResponse.json({ id: user.id, verifyEmailSent: true }, { status: 201 });
}
