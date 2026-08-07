import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RejectionTemplateManager } from "@/components/RejectionTemplateManager";

export default async function RejectionTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({ where: { ownerId: session.user.id } });
  if (!company) redirect("/login");

  const templates = await prisma.rejectionTemplate.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, body: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Rejection templates</h1>
      <p className="mt-2 text-sm text-ink/60">
        Reusable messages you can pick (and still edit) when rejecting a candidate from the applicant pipeline —
        saves retyping the same explanation, and candidates get a clearer answer than a generic no.
      </p>
      <div className="mt-6">
        <RejectionTemplateManager initialTemplates={templates} />
      </div>
    </main>
  );
}
