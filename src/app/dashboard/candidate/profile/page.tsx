import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/ProfileForm";
import { FileUpload } from "@/components/FileUpload";

export default async function CandidateProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: session.user.id },
    include: { certifications: { orderBy: { name: "asc" } } },
  });
  if (!profile) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Your profile</h1>
      <p className="mt-1 text-sm text-ink/60">
        Everything here is private by default. Only you decide if verified employers can find you.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <FileUpload kind="resume" label="Resume / CV (PDF)" accept=".pdf,.doc,.docx" field="resumeKey" endpoint="/api/profile" currentKey={profile.resumeKey} />
        <FileUpload kind="coverLetter" label="Cover letter" accept=".pdf,.doc,.docx" field="coverLetterKey" endpoint="/api/profile" currentKey={profile.coverLetterKey} />
        <FileUpload kind="photo" label="Profile photo" accept="image/*" field="photoKey" endpoint="/api/profile" currentKey={profile.photoKey} />
      </div>

      <div className="mt-8">
        <ProfileForm
          initial={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            headline: profile.headline ?? "",
            summary: profile.summary ?? "",
            phone: profile.phone ?? "",
            countryCode: profile.countryCode ?? "",
            region: profile.region ?? "",
            city: profile.city ?? "",
            yearsExperience: profile.yearsExperience,
            fifoPreference: profile.fifoPreference ?? "",
            willingToRelocate: profile.willingToRelocate,
            siteExperience: profile.siteExperience,
            commodities: profile.commodities,
            visibility: profile.visibility,
            certifications: profile.certifications.map((c) => ({
              name: c.name,
              issuer: c.issuer ?? "",
            })),
          }}
        />
      </div>
    </main>
  );
}
