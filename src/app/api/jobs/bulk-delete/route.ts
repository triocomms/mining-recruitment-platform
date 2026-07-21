import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BULK_DELETE = 200;

const schema = z.object({
  jobIds: z.array(z.string()).min(1, "Select at least one job").max(MAX_BULK_DELETE),
});

/**
 * Bulk remove jobs from the employer's own list. Same hard-delete-vs-archive
 * split as the single DELETE route (src/app/api/jobs/[id]/route.ts): a
 * DRAFT with no applications is removed outright, everything else is
 * archived (hidden everywhere PUBLISHED already isn't shown, but data and
 * application history are kept).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Re-verify ownership server-side rather than trusting the client's
  // selection, same idiom as the admin BULK_APPROVE endpoint.
  const jobs = await prisma.job.findMany({
    where: { id: { in: parsed.data.jobIds }, company: { ownerId: user.id } },
    include: { _count: { select: { applications: true } } },
  });

  const toDelete = jobs.filter((j) => j.status === "DRAFT" && j._count.applications === 0);
  const toArchive = jobs.filter((j) => !(j.status === "DRAFT" && j._count.applications === 0));

  if (toDelete.length > 0) {
    await prisma.job.deleteMany({ where: { id: { in: toDelete.map((j) => j.id) } } });
  }
  if (toArchive.length > 0) {
    await prisma.job.updateMany({ where: { id: { in: toArchive.map((j) => j.id) } }, data: { status: "ARCHIVED" } });
  }

  return NextResponse.json({
    ok: true,
    deleted: toDelete.length,
    archived: toArchive.length,
    // not owned, already gone, or raced by the time we looked
    skipped: parsed.data.jobIds.length - jobs.length,
  });
}
