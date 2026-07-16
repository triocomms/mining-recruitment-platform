import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrivacyControls } from "@/components/PrivacyControls";

export default async function CandidatePrivacyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [profile, requests, consents] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.dataRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { requestedAt: "desc" },
      take: 10,
    }),
    prisma.consentRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Privacy & your data</h1>
      <p className="mt-1 text-sm text-ink/60">
        Under GDPR, CCPA and the Australian Privacy Act you can access, export, or erase the personal
        data we hold about you. These controls are self-service and take effect immediately.
      </p>

      <PrivacyControls visibility={profile?.visibility ?? "PRIVATE"} />

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">Consent history</h2>
        <p className="mt-1 text-xs text-ink/50">
          A permanent, append-only log of every consent you have granted or withdrawn.
        </p>
        {consents.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No consent events recorded.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {consents.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-ink/10 py-2">
                <span>
                  {c.type.replaceAll("_", " ").toLowerCase()} —{" "}
                  <span className={c.granted ? "text-patina" : "text-oxide"}>
                    {c.granted ? "granted" : "withdrawn"}
                  </span>
                </span>
                <span className="text-ink/50">{c.createdAt.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">Data requests</h2>
        {requests.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No export or deletion requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-ink/10 py-2">
                <span>{r.type === "EXPORT" ? "Data export" : "Account deletion"}</span>
                <span className="text-ink/50">
                  {r.status.toLowerCase()} · {r.requestedAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )