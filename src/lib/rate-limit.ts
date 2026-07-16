import { prisma } from "./prisma";
import { PLANS, FREE_DAILY_MESSAGE_CAP, DAILY_MESSAGE_HARD_CAP } from "./plans";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Messaging anti-spam, enforced in the API layer:
 *  - hard cap on messages/day for everyone
 *  - low cap for accounts without an active subscription
 *  - employers may only OPEN new threads if KYB-verified, and only up to
 *    their tier's daily outreach cap
 */
export async function checkMessageAllowance(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const since = new Date(Date.now() - DAY_MS);
  const sent = await prisma.message.count({
    where: { senderUserId: userId, createdAt: { gte: since } },
  });
  if (sent >= DAILY_MESSAGE_HARD_CAP) {
    return { ok: false, reason: "Daily message limit reached. Try again tomorrow." };
  }

  const company = await prisma.company.findUnique({
    where: { ownerId: userId },
    include: { subscription: true },
  });
  const hasActiveSub = company?.subscription?.status === "ACTIVE";
  if (!hasActiveSub && sent >= FREE_DAILY_MESSAGE_CAP) {
    return {
      ok: false,
      reason: `Free accounts can send ${FREE_DAILY_MESSAGE_CAP} messages per day. Upgrade to send more.`,
    };
  }
  return { ok: true };
}

export async function checkEmployerOutreachAllowance(
  userId: string
): Promise<{ ok: boolean; reason?: string }> {
  const company = await prisma.company.findUnique({
    where: { ownerId: userId },
    include: { subscription: true },
  });
  if (!company) return { ok: false, reason: "No company profile found." };
  if (company.verificationStatus !== "VERIFIED") {
    return { ok: false, reason: "Your company must be verified before contacting candidates." };
  }
  const sub = company.subscription;
  if (!sub || sub.status !== "ACTIVE") {
    return { ok: false, reason: "An active subscription is required to start conversations with candidates." };
  }
  const since = new Date(Date.now() - DAY_MS);
  const newThreads = await prisma.messageThread.count({
    where: { companyId: company.id, createdAt: { gte: since } },
  });
  const cap = PLANS[sub.tier].dailyOutreachCap;
  if (newThreads >= cap) {
    return { ok: false, reason: `Daily outreach limit reached (${cap} new conversations on ${PLANS[sub.tier].label}).` };
  }
  return { ok: true };
}
