import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";

const MAX_GALLERY_IMAGES = 6;

const keySchema = z.object({ key: z.string().min(1) });

async function loadOwnedSite(id: string, userId: string) {
    const company = await prisma.company.findUnique({ where: { ownerId: userId } });
    if (!company) return null;
    return prisma.miningSite.findFirst({ where: { id, operatorCompanyId: company.id } });
}

// Same shape as src/app/api/company/gallery (Company.galleryKeys), scoped
// instead to one of the employer's own MiningSite rows.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
    const user = await requireUser("EMPLOYER");
    if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const site = await loadOwnedSite(params.siteId, user.id);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const parsed = keySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const { key } = parsed.data;

  // Keys are {kind}/{ownerUserId}/{uuid} -- reject anything not actually
  // uploaded by this employer, same idiom as src/app/api/company/gallery.
  if (!key.startsWith(`companyMedia/${user.id}/`)) {
        return NextResponse.json({ error: "Not your upload" }, { status: 403 });
  }

  if (site.galleryKeys.length >= MAX_GALLERY_IMAGES) {
        return NextResponse.json(
          { error: `You can add up to ${MAX_GALLERY_IMAGES} photos — remove one first` },
          { status: 400 }
              );
  }
    if (site.galleryKeys.includes(key)) {
          return NextResponse.json({ ok: true, galleryKeys: site.galleryKeys });
    }

  const updated = await prisma.miningSite.update({
        where: { id: site.id },
        data: { galleryKeys: { push: key } },
        select: { galleryKeys: true },
  });
    return NextResponse.json({ ok: true, galleryKeys: updated.galleryKeys });
}

export async function DELETE(req: NextRequest, { params }: { params: { siteId: string } }) {
    const user = await requireUser("EMPLOYER");
    if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const site = await loadOwnedSite(params.siteId, user.id);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
    if (!site.galleryKeys.includes(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const galleryKeys = site.galleryKeys.filter((k) => k !== key);
    await prisma.miningSite.update({ where: { id: site.id }, data: { galleryKeys } });
    await deleteObject(key).catch(() => {});

  return NextResponse.json({ ok: true, galleryKeys });
}
