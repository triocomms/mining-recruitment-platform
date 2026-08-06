import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";

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
    commodity: z.enum(commodityValues).optional().nullable(),
    countryCode: z.string().trim().length(2),
    region: z.string().trim().max(120).optional().nullable().or(z.literal("")),
    city: z.string().trim().max(120).optional().nullable().or(z.literal("")),
    rosterPatterns: z.array(z.string().trim()).optional(),
    accessType: z.enum(["FIFO", "DIDO", "RESIDENTIAL"]).optional().nullable(),
    charterOriginCities: z.array(z.string().trim()).optional(),
    pointsOfHire: z.array(z.string().trim()).optional(),
    driveTimeFromTown: z.string().trim().max(200).optional().nullable().or(z.literal("")),
    roomType: z.string().trim().max(120).optional().nullable().or(z.literal("")),
    wifiNotes: z.string().trim().max(200).optional().nullable().or(z.literal("")),
    gym: z.boolean().optional(),
    pool: z.boolean().optional(),
    foodNotes: z.string().trim().max(400).optional().nullable().or(z.literal("")),
    otherAmenities: z.string().trim().max(400).optional().nullable().or(z.literal("")),
    description: z.string().trim().max(5000).optional().nullable().or(z.literal("")),
    submit: z.boolean().optional(),
});

export async function GET() {
    const user = await requireUser("EMPLOYER");
    if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
    if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

const sites = await prisma.miningSite.findMany({
    where: { operatorCompanyId: company.id },
    orderBy: { createdAt: "desc" },
    });
                                        return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
    const user = await requireUser("EMPLOYER");
    if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

    const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
    if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

                            const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    const d = parsed.data;

const site = await prisma.miningSite.create({
    data: {
        name: d.name,
        slug: makeSlug(d.name),
        operatorCompanyId: company.id,
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
                                                              foodNotes: d.foodNotes || null,
otherAmenities: d.otherAmenities || null,
                           description: d.description || null,
    status: d.submit ? "PENDING_REVIEW" : "DRAFT",
        },
});

return NextResponse.json({ site }, { status: 201 });
}
