import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignDownload } from "@/lib/s3";
import { canViewCandidate } from "@/lib/visibility";

/**
 * All file access goes through this route. It authorizes the request,
 * then redirects to a 5-minute signed URL. Buckets are never public.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  // Blog imagery is public content once attached to a post — no sign-in needed.
  if (key.startsWith("blogCover/") || key.startsWith("blogImage/")) {
    return NextResponse.redirect(await presignDownload(key));
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Files are keyed as {kind}/{ownerUserId}/{uuid} — owners always have access.
  const ownerUserId = key.split("/")[1];
  let allowed = ownerUserId === session.user.id || session.user.role === "ADMIN";

  if (!allowed) {
    // Employers may access candidate files only via the visibility rules.
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId: ownerUserId },
      select: { id: true },
    });
    if (candidate) allowed = await canViewCandidate(session.user, candidate.id);
  }

  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  return NextResponse.redirect(await presignDownload(key));
}
