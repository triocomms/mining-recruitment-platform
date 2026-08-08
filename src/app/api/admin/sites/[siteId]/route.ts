import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const commodityValues = [
  "GOLD",
  "IRON_ORE",
  "COAL",
  "COPPER",
  "LITHIUM",
  "NICKEL",
  "BAUXITE_ALUMINA",
  "URANIUM",
  "MINERAL_SANDS",
  "RARE_EARTHS",
  "ZINC_LEAD",
  "OIL_GAS",
  "OTHER",
  ] as const;

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  operatorCompanyId: z.string().trim().nullable().optional(),
  commodity: z.enum(commodityValues).nullable().optional(),
  countryCode: z.string().trim().length(2).optional(),
  region: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  rosterPatterns: z.array(z.string().trim()).optional(),
  accessType: z.enum(["FIFO", "DIDO", "RESIDENTIAL"]).nullable().optional(),
  charterOriginCities: z.array(z.string().trim()).optional(),
  pointsOfHire: z.array(z.string().trim()).optional(),
  driveTimeFromTown: z.string().trim().max(200).nullable().optional(),
  roomType: z.string().trim().max(120).nullable().optional(),
  wifiNotes: z.string().trim().max(200).nullable().optional(),
  gym: z.boolean().optional(),
  pool: z.boolean().optional(),
  ratingsEnabled: z.boolean().optional(),
  foodNotes: z.string().trim().max(400).nullable().optional(),
  otherAmenities: z.string().trim().max(400).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { siteId: string } }) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

const site = await prisma.miningSite.findUnique({ where: { id: params.siteId } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.countryCode) d.countryCode = d.countryCode.toUpperCase();

const updated = await prisma.miningSite.update({
  where: { id: site.id },
  data: d,
  include: { operatorCompany: { select: { id: true, name: true, slug: true } } },
});

await logAdminAction(admin.id, "MINING_SITE_UPDATED", "MINING_SITE", site.id, site.name);

return NextResponse.json({ site: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { siteId: string } }) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

const site = await prisma.miningSite.findUnique({ where: { id: params.siteId } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

await prisma.miningSite.delete({ where: { id: site.id } });

await logAdminAction(admin.id, "MINING_SITE_DELETED", "MINING_SITE", site.id, site.name);

return NextResponse.json({ ok: true });
}
