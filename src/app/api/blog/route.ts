import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(4).max(160),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().trim().min(50),
  publish: z.boolean().default(false),
});

/** Company blog posts (employers) or editorial posts (admins). */
export async function POST(req: NextRequest) {
  const admin = await requireUser("ADMIN");
  const employer = admin ? null : await requireUser("EMPLOYER");
  if (!admin && !employer) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  let companyId: string | undefined;
  if (employer) {
    const company = await prisma.company.findUnique({ where: { ownerId: employer.id } });
    if (!company) return NextResponse.json({ error: "No company profile" }, { status: 400 });
    // Only verified companies can publish publicly (drafts allowed for all).
    if (d.publish && company.verificationStatus !== "VERIFIED") {
      return NextResponse.json({ error: "Company verification is required before publishing" }, { status: 403 });
    }
    companyId = company.id;
  }

  const post = await prisma.blogPost.create({
    data: {
      type: admin ? "EDITORIAL" : "COMPANY",
      companyId,
      authorId: admin?.id,
      title: d.title,
      slug: makeSlug(d.title),
      excerpt: d.excerpt,
      body: d.body,
      status: d.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: d.publish ? new Date() : null,
    },
  });
  return NextResponse.json({ id: post.id, slug: post.slug }, { status: 201 });
}
