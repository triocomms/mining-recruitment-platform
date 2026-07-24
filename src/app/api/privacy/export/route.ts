import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildUserExport } from "@/lib/privacy";

/** GDPR Art. 15 / Art. 20 & CCPA right-to-know: full data export as JSON. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  await prisma.dataRequest.create({
    data: { userId: session.user.id, type: "EXPORT", status: "COMPLETED", completedAt: new Date() },
  });

  const bundle = await buildUserExport(session.user.id);
  if (!bundle) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fifodido-data-export-${Date.now()}.json"`,
    },
  });
}
