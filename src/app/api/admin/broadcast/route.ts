import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";
import { Commodity, PlanTier, Prisma } from "@prisma/client";

export const maxDuration = 60;

const schema = z.object({
  audience: z.enum(["CANDIDATES", "EMPLOYERS", "ALL"]),
  tier: z.nativeEnum(PlanTier).optional(), // employers only
  commodity: z.nativeEnum(Commodity).optional(), // candidates only
  region: z.string().trim().max(80).optional(), // candidates only
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(20000),
  preview: z.boolean().default(false),
});

/**
 * Segment builder. Marketing sends respect ConsentRecord: anyone whose most
 * recent MARKETING_EMAIL record is granted=false is excluded (opt-out model).
 */
async function buildRecipients(d: z.infer<typeof schema>) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    suspendedAt: null,
    ...(d.audience === "CANDIDATES"
      ? { role: "CANDIDATE" as const }
      : d.audience === "EMPLOYERS"
        ? { role: "EMPLOYER" as const }
        : { role: { in: ["CANDIDATE", "EMPLOYER"] as const } }),
  };

  if (d.tier) {
    where.company = { subscription: { status: "ACTIVE", tier: d.tier } };
  }
  if (d.commodity || d.region) {
    where.candidate = {
      ...(d.commodity ? { commodities: { has: d.commodity } } : {}),
      ...(d.region ? { region: { equals: d.region, mode: "insensitive" } } : {}),
    };
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true },
    take: 5000,
  });

  // Exclude users whose latest MARKETING_EMAIL consent record withdraws consent.
  const optedOut = new Set<string>();
  const consents = await prisma.consentRecord.findMany({
    where: { type: "MARKETING_EMAIL", userId: { in: users.map((u) => u.id) } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, granted: true },
  });
  const latest = new Map<string, boolean>();
  for (const c of consents) latest.set(c.userId, c.granted); // ascending → last write wins
  latest.forEach((granted, userId) => {
    if (!granted) optedOut.add(userId);
  });

  return users.filter((u) => !optedOut.has(u.id));
}

export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const recipients = await buildRecipients(d);
  const segment = [
    d.audience.toLowerCase(),
    d.tier && `tier=${d.tier}`,
    d.commodity && `commodity=${d.commodity}`,
    d.region && `region=${d.region}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (d.preview) {
    return NextResponse.json({ recipients: recipients.length, segment });
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      subject: d.subject,
      body: d.body,
      segment,
      recipients: recipients.length,
      createdById: admin.id,
    },
  });

  let sent = 0;
  let failed = 0;
  const CHUNK = 20;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((r) =>
        sendEmail({
          to: r.email,
          subject: d.subject,
          body: d.body,
          template: "BROADCAST",
          broadcastId: broadcast.id,
        })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) sent++;
      else failed++;
    }
  }

  await prisma.broadcast.update({ where: { id: broadcast.id }, data: { sent, failed } });
  await logAdminAction(admin.id, "BROADCAST_SEND", "USER", broadcast.id, `${segment} → ${sent} sent, ${failed} failed`);

  return NextResponse.json({ ok: true, recipients: recipients.length, sent, failed });
}
