import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getStatsRange, resolveRange, toCsv, isoDate } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const { from, to } = resolveRange({
    preset: searchParams.get("preset") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const stats = await getStatsRange(from, to);
  const csv = toCsv(stats);
  const filename = `fifodido-analytics_${isoDate(from)}_to_${isoDate(to)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
