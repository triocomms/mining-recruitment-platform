import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

/**
 * Admin removal of any job, regardless of owner or status -- for corrupted
 * or garbage listings (bad RSS parses, spam, etc.) that don't belong on the
 * site. Same hard-delete-vs-archive split as the employer-facing DELETE
 * route (src/app/api/jobs/[id]/route.ts): a DRAFT with no applications is
 * removed outright, everything else (including PUBLISHED) is archived --
 * hidden from every public query the same way DRAFT already is, application
 * history kept, and the row stays in place so a bad RSS import isn't
 * silently re-created on the next sync (which dedupes against this row via
 * externalRef).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { _count: { select: { applications: true } } },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status === "DRAFT" && job._count.applications === 0) {
    await prisma.job.delete({ where: { id: job.id } });
    await logAdminAction(user.id, "JOB_DELETE", "JOB", job.id);
    return NextResponse.json({ ok: true, mode: "deleted" });
  }

  await prisma.job.update({ where: { id: job.id }, data: { status: "ARCHIVED" } });
  await logAdminAction(user.id, "JOB_ARCHIVE", "JOB", job.id);
  return NextResponse.json({ ok: true, mode: "archived" });
}
