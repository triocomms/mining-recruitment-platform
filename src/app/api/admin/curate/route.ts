import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  postId: z.string(),
  curatedRank: z.number().int().min(0).nullable(), // null removes from homepage
  hide: z.boolean().optional(),
});

/** Admin homepage curation + moderation of blog posts. */
export async function POST(req: NextRequest) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await prisma.blogPost.update({
    where: { id: parsed.data.postId },
    data: {
      curatedRank: parsed.data.curatedRank,
      ...(parsed.data.hide !== undefined ? { status: parsed.data.hide ? "HIDDEN" : "PUBLISHED" } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
