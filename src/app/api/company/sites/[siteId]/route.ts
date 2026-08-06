import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
    foodNotes: z.string().trim().max(400).nullable().optional(),
    otherAmenities: z.string().trim().max(400).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    heroImageKey: z.string().nullable().optional(),
    submit: z.boolean().optional(),
});

async function loadOwnedSite(id: string, userId: string) {
    const company = await prisma.company.findUnique({ where: { ownerId: userId } });
    if (!company) return null;
    const site = await prisma.miningSite.findFirst({ where: { id, operatorCompanyId: company.id } });
    return site;
}

// Employer edit of one of their own sites. Only DRAFT -> PENDING_REVIEW
// (via `submit`) is available here -- moving anything to PUBLISHED is an
// admin-only action (src/app/api/admin/sites/[siteId]), same as jobs.
export async function PATCH(req: NextRequest, { params }: { params: { siteId: string } }) {
    const user = await requireUser("EMPLOYER");
    if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const site = await loadOwnedSite(params.siteId, user.id);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
    }
    const { submit, ...fields } = parsed.data;
    if (fields.countryCode) fields.countryCode = fields.countryCode.toUpperCase();

  const data: Prisma.MiningSiteUpdateInput = { ...fields };
    // A rejected site is returned to DRAFT by the admin (see
  // src/app/api/admin/sites/[siteId]) -- resubmitting it just re-enters the
  // review queue, same shape as EditJobForm's "Resubmit for review".
  if (submit && site.status === "DRAFT") {
        data.status = "PENDING_REVIEW";
  }

  const updated = await prisma.miningSite.update({ where: { id: site.id }, data });
    return NextResponse.json({ site: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { siteId: string } }) {
    const user = await requireUser("EMPLOYER");
    if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const site = await loadOwnedSite(params.siteId, user.id);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  await prisma.miningSite.delete({ where: { id: site.id } });
    return NextResponse.json({ ok: true });
}
