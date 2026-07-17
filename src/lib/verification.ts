import crypto from "crypto";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import type { Role } from "@prisma/client";

/**
 * Email verification. Raw tokens are random 32-byte strings sent by email;
 * only their SHA-256 hash is stored. Tokens expire after 24 hours and are
 * single-use (cleared on success).
 */

const TOKEN_TTL_MS = 24 * 3600 * 1000;

const hash = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/** Generates a fresh token for the user (invalidating any previous one). */
export async function issueVerificationToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { verifyTokenHash: hash(raw), verifyTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return raw;
}

export async function sendVerificationEmail(user: { id: string; email: string; role: Role }) {
  const raw = await issueVerificationToken(user.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link = `${appUrl}/verify-email?token=${raw}`;

  const roleBlurb =
    user.role === "EMPLOYER"
      ? "Once verified, sign in and submit your company verification (KYB) documents from the employer dashboard — verified companies get a badge and their job ads publish faster."
      : "Once verified, sign in to complete your profile, upload your resume and tickets, and start applying.";

  return sendEmail({
    to: user.email,
    subject: "Confirm your email — Orebridge",
    body: `Welcome to Orebridge!\n\nConfirm your email address to activate your account:\n\n${link}\n\nThis link expires in 24 hours.\n\n${roleBlurb}\n\nIf you didn't create this account, you can ignore this email.`,
    template: "EMAIL_VERIFY",
  });
}

/** Consumes a raw token. Returns the verified user's email, or null. */
export async function verifyEmailToken(raw: string): Promise<string | null> {
  if (!raw || raw.length < 32) return null;
  const user = await prisma.user.findUnique({ where: { verifyTokenHash: hash(raw) } });
  if (!user) return null;
  if (!user.verifyTokenExpiresAt || user.verifyTokenExpiresAt < new Date()) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), verifyTokenHash: null, verifyTokenExpiresAt: null },
  });
  return user.email;
}
