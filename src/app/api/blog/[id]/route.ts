import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    title: z.string().trim().min(4).max(160),
    excerpt: z.string().trim().max(300).optional(),
    body: z.string().trim().min(50),
    coverKey: z.string().startsWith("blogCover/").optional(),
    coverAlt: z.string().trim().max(200).optional(),
    gallery: z
      .array(
        z.object({
          key: z.string().startsWith("blogImage/"),
          altText: z.string().trim().min(3, "Alt text is required on every image").max(200),
        })
      )
      .max(12)
      .default([]),
    publish: z.boolean().default(false),
  })
  .refine((d) => !d.coverKey || (d.coverAlt && d.coverAlt.length >= 3), {
    message: "Alt text is required for the cover image",
  });

/** Confirms the signed-in user (admin or employer) is allowed to touch this
 *  specific post, and returns the actor kind. Employers only ever own their
 *  own company's COMPANY posts; admins are treated as collectively owning
 *  every EDITORIAL post (the "FiFoDiDo" voice isn't tied to one account),
 *  mirroring the authorization already used for creation in /api/blog. */
async function authorizePost(postId: string) {
  const admin = await requireUser("ADMIN");
  const employer = admin ? null : await requireUser("EMPLOYER");
  if (!admin && !employer) return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) } as const;

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return { error: NextResponse.json({ error: "Post not found" }, { status: 404 }) } as const;

  if (admin) {
    if (post.type !== "EDITORIAL") {
      return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) } as const;
    }
    return { post, admin, employer: null } as const;
  }

  const company = await prisma.company.findUnique({ where: { ownerId: employer!.id } });
  if (!company || post.companyId !== company.id) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) } as const;
  }
  return { post, admin: null, employer, company } as const;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizePost(params.id);
  if ("error" in authz) return authz.error;
  const { post, employer } = authz;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  if (employer && d.publish) {
    const company = await prisma.company.findUnique({ where: { ownerId: employer.id } });
    if (company?.verificationStatus !== "VERIFIED") {
      return NextResponse.json({ error: "Company verification is required before publishing" }, { status: 403 });
    }
  }

  const updated = await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      title: d.title,
      // Slug intentionally left unchanged on edit — it may already be shared/linked.
      excerpt: d.excerpt,
      body: d.body,
      coverKey: d.coverKey,
      coverAlt: d.coverAlt,
      status: d.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: d.publish ? post.publishedAt ?? new Date() : null,
      images: {
        deleteMany: {},
        create: d.gallery.map((g, i) => ({ key: g.key, altText: g.altText, order: i })),
      },
    },
  });
  return NextResponse.json({ id: updated.id, slug: updated.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizePost(params.id);
  if ("error" in authz) return authz.error;
  await prisma.blogPost.delete({ where: { id: authz.post.id } });
  return NextResponse.json({ ok: true });
}
