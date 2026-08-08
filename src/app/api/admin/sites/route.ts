import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";
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

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  operatorCompanyId: z.string().trim().optional().or(z.literal("")),
  commodity: z.enum(commodityValues).optional(),
  countryCode: z.string().trim().length(2),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  rosterPatterns: z.array(z.string().trim()).optional(),
  accessType: z.enum(["FIFO", "DIDO", "RESIDENTIAL"]).optional(),
  charterOriginCities: z.array(z.string().trim()).optional(),
  pointsOfHire: z.array(z.string().trim()).optional(),
  driveTimeFromTown: z.string().trim().max(200).optional().or(z.literal("")),
  roomType: z.string().trim().max(120).optional().or(z.literal("")),
  wifiNotes: z.string().trim().max(200).optional().or(z.literal("")),
  gym: z.boolean().optional(),
  pool: z.boolean().optional(),
  ratingsEnabled: z.boolean().optional(),
  foodNotes: z.string().trim().max(400).optional().or(z.literal("")),
  otherAmenities: z.string().trim().max(400).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

// Admin-only mining site directory — the seed/authoring surface for the
// roster/camp/logistics data layer (see MiningSite in schema.prisma).
// Employers can also attach a job to a site or create one inline at job
// posting time; this is the canonical CRUD screen for cleanup and manual
// seeding of major sites.
export async function GET() {
  const user = await requireUser("ADMIN");
  if (!user) return NextResponse.json({ error: "Admin only" }, { status: 403 });

const sites = await prisma.miningSite.findMany({
  orderBy: { createdAt: "desc" },
  include: { operatorCompany: { select: { id: true, name: true, slug: true } } },
});
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const d = parsed.data;

const site = await prisma.miningSite.create({
  data: {
    name: d.name,
    slug: makeSlug(d.name),
    operatorCompanyId: d.operatorCompanyId || null,
    commodity: d.commodity,
    countryCode: d.countryCode.toUpperCase(),
    region: d.region || null,
    city: d.city || null,
    rosterPatterns: d.rosterPatterns ?? [],
    accessType: d.accessType,
    charterOriginCities: d.charterOriginCities ?? [],
    pointsOfHire: d.pointsOfHire ?? [],
    driveTimeFromTown: d.driveTimeFromTown || null,
    roomType: d.roomType || null,
    wifiNotes: d.wifiNotes || null,
    gym: d.gym ?? false,
    pool: d.pool ?? false,
    ratingsEnabled: d.ratingsEnabled ?? true,
    foodNotes: d.foodNotes || null,
    otherAmenities: d.otherAmenities || null,
    status: d.status ?? "DRAFT",
  },
  include: { operatorCompany: { select: { id: true, name: true, slug: true } } },
});

await logAdminAction(admin.id, "MINING_SITE_CREATED", "MINING_SITE", site.id, site.name);

return NextResponse.json({ site }, { status: 201 });
}
