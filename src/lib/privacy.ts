import { prisma } from "./prisma";
import { deleteObject } from "./s3";

/**
 * GDPR Art. 15 / CCPA "right to know": assemble everything we hold on a user
 * into a portable JSON bundle. File contents are referenced by storage key;
 * the export endpoint attaches short-lived signed download URLs.
 */
export async function buildUserExport(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      consents: true,
      dataRequests: true,
      candidate: {
        include: {
          certifications: true,
          applications: { include: { job: { select: { title: true, slug: true, company: { select: { name: true } } } } } },
          bookmarks: { include: { job: { select: { title: true, slug: true } } } },
          followedCompanies: { include: { company: { select: { name: true, slug: true } } } },
          threads: { include: { messages: true, company: { select: { name: true } } } },
          promotions: true,
        },
      },
      company: {
        include: {
          jobs: true,
          blogPosts: true,
          subscription: true,
          threads: { include: { messages: true } },
        },
      },
    },
  });
  if (!user) return null;
  const { passwordHash: _omit, ...safeUser } = user as any;
  return {
    exportedAt: new Date().toISOString(),
    format: "orebridge-user-export/v1",
    data: safeUser,
  };
}

/**
 * GDPR Art. 17 / CCPA deletion.
 * Strategy: immediate anonymization + soft delete, then S3 object removal.
 * Messages sent to other users are anonymized rather than destroyed (their
 * recipients' legitimate interest), consistent with common DPA guidance.
 */
export async function eraseUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { candidate: { include: { certifications: true } }, company: true },
  });
  if (!user) return;

  const s3Keys: string[] = [];
  if (user.candidate) {
    const c = user.candidate;
    for (const k of [c.photoKey, c.resumeKey, c.coverLetterKey]) if (k) s3Keys.push(k);
    for (const cert of c.certifications) if (cert.documentKey) s3Keys.push(cert.documentKey);
  }
  if (user.company?.logoKey) s3Keys.push(user.company.logoKey);
  if (user.company?.kybDocumentKey) s3Keys.push(user.company.kybDocumentKey);

  await prisma.$transaction(async (tx) => {
    if (user.candidate) {
      await tx.certification.deleteMany({ where: { candidateId: user.candidate.id } });
      await tx.application.updateMany({
        where: { candidateId: user.candidate.id },
        data: { coverNote: null, resumeKey: null, status: "WITHDRAWN" },
      });
      await tx.candidateProfile.update({
        where: { id: user.candidate.id },
        data: {
          firstName: "Deleted",
          lastName: "User",
          headline: null,
          summary: null,
          phone: null,
          city: null,
          region: null,
          photoKey: null,
          resumeKey: null,
          coverLetterKey: null,
          visibility: "PRIVATE",
        },
      });
    }
    await tx.message.updateMany({
      where: { senderUserId: userId },
      data: { body: "[message removed — account deleted]" },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        passwordHash: "",
        deletedAt: new Date(),
      },
    });
    await tx.dataRequest.updateMany({
      where: { userId, type: "DELETE", status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  // Best-effort object storage cleanup after the DB commit.
  await Promise.allSettled(s3Keys.map((k) => deleteObject(k)));
}
