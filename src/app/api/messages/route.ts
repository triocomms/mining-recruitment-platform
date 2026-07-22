import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkMessageAllowance, checkEmployerOutreachAllowance } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";
import { truncateForPreview } from "@/lib/notification-copy";

const schema = z.object({
  // Either an existing thread, or a target to open one with.
  threadId: z.string().optional(),
  candidateId: z.string().optional(), // employer → candidate outreach
  companyId: z.string().optional(),   // candidate → company (only after applying)
  body: z.string().trim().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const user = session.user;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;

  const allowance = await checkMessageAllowance(user.id);
  if (!allowance.ok) return NextResponse.json({ error: allowance.reason }, { status: 429 });

  let threadId = d.threadId;

  if (!threadId) {
    if (user.role === "EMPLOYER" && d.candidateId) {
      // KYB-gated outreach with per-tier daily caps.
      const outreach = await checkEmployerOutreachAllowance(user.id);
      if (!outreach.ok) return NextResponse.json({ error: outreach.reason }, { status: 403 });

      const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
      const candidate = await prisma.candidateProfile.findUnique({ where: { id: d.candidateId } });
      if (!company || !candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Employers may only contact PUBLIC profiles or their own applicants.
      if (candidate.visibility !== "PUBLIC") {
        const applied = await prisma.application.findFirst({
          where: { candidateId: candidate.id, job: { companyId: company.id } },
        });
        if (!applied) return NextResponse.json({ error: "This candidate is not contactable" }, { status: 403 });
      }

      const thread = await prisma.messageThread.upsert({
        where: { companyId_candidateId: { companyId: company.id, candidateId: candidate.id } },
        create: { companyId: company.id, candidateId: candidate.id },
        update: {},
      });
      threadId = thread.id;
    } else if (user.role === "CANDIDATE" && d.companyId) {
      const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
      if (!candidate) return NextResponse.json({ error: "No profile" }, { status: 400 });
      // Candidates can only initiate with companies they've applied to (anti-spam).
      const applied = await prisma.application.findFirst({
        where: { candidateId: candidate.id, job: { companyId: d.companyId } },
      });
      if (!applied) {
        return NextResponse.json(
          { error: "You can message a company after applying to one of their jobs" },
          { status: 403 }
        );
      }
      const thread = await prisma.messageThread.upsert({
        where: { companyId_candidateId: { companyId: d.companyId, candidateId: candidate.id } },
        create: { companyId: d.companyId, candidateId: candidate.id },
        update: {},
      });
      threadId = thread.id;
    } else {
      return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
    }
  }

  // Verify membership of the thread before sending.
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      company: { select: { ownerId: true, name: true, owner: { select: { email: true } } } },
      candidate: { select: { userId: true, firstName: true, lastName: true, user: { select: { email: true } } } },
    },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const isMember = thread.company.ownerId === user.id || thread.candidate.userId === user.id;
  if (!isMember) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const message = await prisma.message.create({
    data: { threadId, senderUserId: user.id, body: d.body },
  });
  await prisma.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // Notify whichever side didn't just send this message. Best-effort:
  // notifyUser() never throws, so a failure here can't fail the send.
  const senderIsEmployer = thread.company.ownerId === user.id;
  const recipient = senderIsEmployer
    ? { userId: thread.candidate.userId, email: thread.candidate.user.email, senderName: thread.company.name }
    : { userId: thread.company.ownerId, email: thread.company.owner.email, senderName: `${thread.candidate.firstName} ${thread.candidate.lastName}` };
  const preview = truncateForPreview(d.body);
  notifyUser({
    userId: recipient.userId,
    type: "NEW_MESSAGE",
    title: `New message from ${recipient.senderName}`,
    body: preview,
    linkUrl: `/dashboard/messages/${threadId}`,
    email: {
      to: recipient.email,
      subject: `New message from ${recipient.senderName}`,
      body: `${preview}\n\nReply from your Orebridge dashboard.`,
      template: "NEW_MESSAGE",
    },
  }).catch((e) => console.error("[messages] notification failed", e));

  return NextResponse.json({ id: message.id, threadId }, { status: 201 });
}
