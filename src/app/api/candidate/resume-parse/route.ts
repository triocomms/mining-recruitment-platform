import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { detectResumeFileKind, extractResumeFields } from "@/lib/resume-parse";

/**
 * Suggests profile fields from the candidate's already-uploaded resume
 * (P2.7). Heuristic/keyword-based only — see resume-parse.ts for why. This
 * endpoint never writes to the profile itself; it only returns suggestions
 * for the client to merge into the (unsaved) form state, so the candidate
 * always reviews before "Save profile" persists anything.
 */
export async function POST() {
  const user = await requireUser("CANDIDATE");
  if (!user) return NextResponse.json({ error: "Sign in as a candidate" }, { status: 403 });

  const candidate = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidate) return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });
  if (!candidate.resumeKey) {
    return NextResponse.json({ error: "Upload a resume first, then try again" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await getObjectBuffer(candidate.resumeKey);
  } catch (e) {
    console.error("[resume-parse] failed to fetch resume from storage", e);
    return NextResponse.json({ error: "Could not read your resume file — try re-uploading it" }, { status: 500 });
  }

  const kind = detectResumeFileKind(buffer);
  let text = "";
  try {
    if (kind === "pdf") {
      // Import the internal lib entry point rather than the package root:
      // pdf-parse's index.js has a debug-mode check (`!module.parent`) that
      // can misfire under a bundler (Next.js/webpack) and try to read a
      // fixture PDF off disk that isn't there in production. The lib entry
      // skips that check entirely — same parser, no debug branch.
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      text = (await pdfParse(buffer)).text;
    } else if (kind === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
    }
  } catch (e) {
    console.error("[resume-parse] failed to extract text", e);
    return NextResponse.json({ error: "Could not read this file — it may be corrupted" }, { status: 500 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "Couldn't find any text in that file — a scanned image PDF won't work, only a text-based PDF or Word doc." },
      { status: 422 }
    );
  }

  return NextResponse.json({ suggested: extractResumeFields(text) });
}
