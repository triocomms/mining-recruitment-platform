import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CandidateProfileView } from "@/components/CandidateProfileView";

// Separate route (rather than reusing the employer route) because
// middleware.ts redirects any non-EMPLOYER session away from
// /dashboard/employer/* before this page would ever run.
export default async function PreviewProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { email: true } },
      certifications: { select: { name: true, expiresAt: true, verificationStatus: true }, orderBy: { name: "asc" } },
      employmentHistory: {
        where: { verificationStatus: "VERIFIED" },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!profile) redirect("/login");

  const activePromotion = await prisma.promotionListing.findFirst({
    where: { candidateId: profile.id, paidAt: { not: null }, expiresAt: { gt: new Date() } },
    select: { id: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-ink/60">
        <Link href="/dashboard/candidate" className="underline">Dashboard</Link> / Preview my profile
      </p>
      {profile.visibility !== "PUBLIC" && (
        <div className="mt-4 rounded-md border border-oregold/40 bg-oregold/10 px-4 py-3 text-sm">
          Your profile is currently <strong>private</strong> -- this preview only shows what employers would see if
          you turn on visibility (or once you apply to one of their jobs), from{" "}
          <Link href="/dashboard/candidate/profile" className="font-semibold underline">your profile settings</Link>.
        </div>
      )}
      <div className="mt-4">
        <CandidateProfileView
          profile={profile}
          email={profile.user.email}
          phone={profile.phone}
          promoted={Boolean(activePromotion)}
          isPreview
          canMessage={false}
        />
      </div>
    </main>
  );
}
