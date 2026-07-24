import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCandidateViewAccess } from "@/lib/visibility";
import { CandidateProfileView } from "@/components/CandidateProfileView";

export default async function EmployerCandidateProfilePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { email: true, deletedAt: true } },
      certifications: { select: { name: true, expiresAt: true, verificationStatus: true }, orderBy: { name: "asc" } },
      employmentHistory: {
        where: { verificationStatus: "VERIFIED" },
        orderBy: { startDate: "desc" },
      },
    },
  });

  // Never reveal *why* a profile can't be seen (deleted account, private
  // profile, no relationship) -- treat every disallowed case identically.
  if (!candidate || candidate.user.deletedAt) notFound();

  const access = await getCandidateViewAccess(session.user, candidate.id);
  if (!access.allowed) notFound();

  const activePromotion = await prisma.promotionListing.findFirst({
    where: { candidateId: candidate.id, paidAt: { not: null }, expiresAt: { gt: new Date() } },
    select: { id: true },
  });

  const showContact = access.reason === "SELF" || access.reason === "ADMIN" || access.reason === "APPLIED";
  const canMessage = access.reason === "PUBLIC" || access.reason === "APPLIED";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-ink/60">
        <Link href="/dashboard/employer/candidates" className="underline">Resume database</Link> / Profile
      </p>
      <div className="mt-4">
        <CandidateProfileView
          profile={candidate}
          email={showContact ? candidate.user.email : null}
          phone={showContact ? candidate.phone : null}
          promoted={Boolean(activePromotion)}
          canMessage={canMessage}
        />
      </div>
    </main>
  );
}
