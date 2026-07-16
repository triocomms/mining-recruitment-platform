import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSearchResumeDatabase } from "@/lib/visibility";
import { CandidateSearch } from "@/components/CandidateSearch";

export default async function EmployerCandidatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({ where: { ownerId: session.user.id } });
  if (!company) redirect("/login");

  const allowed = await canSearchResumeDatabase(session.user.id);

  const jobs = allowed
    ? await prisma.job.findMany({
        where: { companyId: company.id, status: { in: ["PUBLISHED", "PENDING_REVIEW", "DRAFT"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, title: true },
      })
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Resume database</h1>
      <p className="mt-1 text-sm text-ink/60">
        Search candidates who have opted in to being discovered by verified employers.
        Only public summary fields are shown — full profiles open once a candidate replies or applies.
      </p>

      {!allowed ? (
        <div className="card mt-6 border-2 border-oregold">
          <p className="font-semibold">Resume search is a Gold feature for verified companies.</p>
          <ul className="mt-2 space-y-1 text-sm text-ink/60">
            {company.verificationStatus !== "VERIFIED" && (
              <li>• Your company is not yet verified — <Link href="/dashboard/employer" className="underline">submit KYB documents</Link></li>
            )}
            <li>• Requires an active Gold subscription — <Link href="/dashboard/employer/billing" className="underline">view plans</Link></li>
          </ul>
        </div>
      ) : (
        <div className="mt-6">
          <CandidateSearch jobs={jobs} />
        </div>
      )}
    </main>
  );
}
