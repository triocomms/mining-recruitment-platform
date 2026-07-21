import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";

const MAX_GALLERY_IMAGES = 6;

const keySchema = z.object({ key: z.string().min(1) });

/** Adds one photo (by S3 key, already uploaded via the presign flow) to the
 * company's branding gallery, shown on its public company page. */
export async function POST(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const parsed = keySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { key } = parsed.data;

  // Keys are {kind}/{ownerUserId}/{uuid} — reject anything not actually
  // uploaded by this employer, same idiom as src/app/api/files/route.ts.
  if (!key.startsWith(`companyMedia/${user.id}/`)) {
    return NextResponse.json({ error: "Not your upload" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });

  if (company.galleryKeys.length >= MAX_GALLERY_IMAGES) {
    return NextResponse.json(
      { error: `You can add up to ${MAX_GALLERY_IMAGES} photos — remove one first` },
      { status: 400 }
    );
  }
  if (company.galleryKeys.includes(key)) {
    return NextResponse.json({ ok: true, galleryKeys: company.galleryKeys });
  }

  const updated = await prisma.company.update({
    where: { id: company.id },
    data: { galleryKeys: { push: key } },
    select: { galleryKeys: true },
  });
  return NextResponse.json({ ok: true, galleryKeys: updated.galleryKeys });
}

/** Removes one photo from the gallery and deletes the underlying object. */
export async function DELETE(req: NextRequest) {
  const user = await requireUser("EMPLOYER");
  if (!user) return NextResponse.json({ error: "Employer account required" }, { status: 403 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { ownerId: user.id } });
  if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });
  if (!company.galleryKeys.includes(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const galleryKeys = company.galleryKeys.filter((k) => k !== key);
  await prisma.company.update({ where: { id: company.id }, data: { galleryKeys } });
  await deleteObject(key).catch(() => {}); // best-effort; DB is the source of truth

  return NextResponse.json({ ok: true, galleryKeys });
}
