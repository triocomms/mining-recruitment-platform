import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Recent notifications for the bell dropdown, plus the unread count for
 *  the badge. Kept to 30 rows — the full history lives at
 *  /dashboard/notifications, this endpoint only backs the dropdown. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

const patchSchema = z.union([z.object({ id: z.string() }), z.object({ all: z.literal(true) })]);

/** Mark one notification, or all of the caller's notifications, as read. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if ("all" in parsed.data) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    // id + userId both in the where clause — a user can never mark someone
    // else's notification read this way.
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: session.user.id },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
