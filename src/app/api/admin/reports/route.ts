import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

const schema = z.object({
  reportId: z.string(),
  status: z.enum(["RESOLVED", "DISMISSED"]),
  note: z.string().trim().max(1000).optional(),
});

/** Close out reports: RESOLVED = upheld (counts against company trust), DISMISSED = no action. */
export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const d = parsed.data;

  const report = await prisma.report.findUnique({ where: { id: d.reportId } });
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (report.status !== "OPEN") {
    return NextResponse.json({ error: "Report is already closed" }, { status: 400 });
  }

  await prisma.report.update({
    where: { id: report.id },
    data: { status: d.status, resolutionNote: d.note, resolvedAt: new Date() },
  });

  // Upholding a report against a review moderates it off the site.
  if (d.status === "RESOLVED" && report.targetType === "REVIEW") {
    await prisma.companyReview
      .update({ where: { id: report.targetId }, data: { status: "HIDDEN" } })
      .catch(() => {}); // review may already be gone
  }
  await logAdminAction(
    admin.id,
    d.status === "RESOLVED" ? "REPORT_RESOLVE" : "REPORT_DISMISS",
    "REPORT",
    report.id,
    d.note
  );
  return NextResponse.json({ ok: true });
}
