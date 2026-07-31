import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Tiny status-only lookup used exclusively by src/middleware.ts to decide
 * whether a /jobs/[slug] request should be answered with a genuine HTTP 410
 * Gone. Next.js App Router has no supported way to set a custom status code
 * from a Server Component page, so the check has to happen here, one layer
 * up, before the page ever renders. Kept in its own top-level path (rather
 * than nested under api/jobs/[id]) because Next.js does not allow two
 * differently-named dynamic segments ([id] and [slug]) at the same route
 * level.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const job = await prisma.job.findUnique({
    where: { slug: params.slug },
    select: { status: true },
  });
  return NextResponse.json({ status: job?.status ?? null });
}
