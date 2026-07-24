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
    subject: "Confirm your email — FiFoDiDo",
    body: `Welcome to FiFoDiDo!\n\nConfirm your email address to activate your account:\n\n${link}\n\nThis link expires in 24 hours.\n\n${roleBlurb}\n\nIf you didn't create this account, you can ignore this email.`,
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

/**
 * Self-service email change (see api/account/email/route.ts). The requested
 * address is held in `pendingEmail` and only promoted to `email` once its
 * confirmation link is clicked — this proves the account holder actually
 * controls the new inbox and means a typo can't ever lock them out.
 */
export async function issueEmailChangeToken(userId: string, newEmail: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: newEmail,
      pendingEmailTokenHash: hash(raw),
      pendingEmailTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return raw;
}

export async function sendEmailChangeConfirmation(currentEmail: string, newEmail: string, raw: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link = `${appUrl}/verify-email-change?token=${raw}`;

  await sendEmail({
    to: newEmail,
    subject: "Confirm your new email — FiFoDiDo",
    body: `Confirm this address to finish updating your FiFoDiDo login email:\n\n${link}\n\nThis link expires in 24 hours. Your login email stays as ${currentEmail} until you click it.\n\nIf you didn't request this, you can safely ignore this email — no change has been made.`,
    template: "EMAIL_CHANGE_CONFIRM",
  });

  // Notify the current address too, so an attacker who guesses a candidate's
  // password can't quietly redirect their login email without them noticing.
  await sendEmail({
    to: currentEmail,
    subject: "Email change requested — FiFoDiDo",
    body: `Someone requested changing your FiFoDiDo login email to ${newEmail}.\n\nIf this was you, check ${newEmail} for a confirmation link — nothing changes until it's clicked.\n\nIf this wasn't you, your password may be compromised — sign in and change it from Account settings immediately.`,
    template: "EMAIL_CHANGE_NOTICE",
  });
}

/** Consumes a raw token, promoting pendingEmail to email. Returns the new email, or null. */
export async function confirmEmailChangeToken(raw: string): Promise<string | null> {
  if (!raw || raw.length < 32) return null;
  const user = await prisma.user.findUnique({ where: { pendingEmailTokenHash: hash(raw) } });
  if (!user || !user.pendingEmail) return null;
  if (!user.pendingEmailTokenExpiresAt || user.pendingEmailTokenExpiresAt < new Date()) return null;

  const newEmail = user.pendingEmail;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: newEmail,
      pendingEmail: null,
      pendingEmailTokenHash: null,
      pendingEmailTokenExpiresAt: null,
    },
  });
  return newEmail;
}
