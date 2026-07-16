import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { presignUpload, UPLOAD_RULES } from "@/lib/s3";

const schema = z.object({
  kind: z.enum(Object.keys(UPLOAD_RULES) as [string, ...string[]]),
  contentType: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const result = await presignUpload(session.user.id, parsed.data.kind as any, parsed.data.contentType);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Upload not allowed" }, { status: 400 });
  }
}
