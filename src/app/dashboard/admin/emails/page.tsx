import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { AdminEmailResendButton } from "@/components/AdminActions";
import { BroadcastComposer } from "@/components/BroadcastComposer";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [emails, broadcasts] = await Promise.all([
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Email</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>

      <section className="mt-6">
        <h2 className="font-display text-xl uppercase tracking-wide">Compose broadcast</h2>
        <div className="mt-3">
          <BroadcastComposer />
        </div>
        {broadcasts.length > 0 && (
          <ul className="mt-4 space-y-2">
            {broadcasts.map((b) => (
              <li key={b.id} className="card text-sm">
                <p className="font-semibold">{b.subject}</p>
                <p className="text-xs text-ink/60">
                  {b.segment} · {b.sent}/{b.recipients} sent
                  {b.failed > 0 && <span className="text-oxide"> · {b.failed} failed</span>}
                  {" · "}{timeAgo(b.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-wide">
          Transactional email log ({emails.length} recent)
        </h2>
        {emails.length === 0 ? (
          <p className="card mt-3 text-sm text-ink/60">No emails sent yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {emails.map((e) => (
              <li key={e.id} className="card flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="font-semibold">{e.to}</span> — {e.subject}
                  </p>
                  <p className="text-xs text-ink/60">
                    <span className="tag mr-1">{e.template.toLowerCase()}</span>
                    <span className={e.status === "SENT" ? "text-patina" : "text-oxide"}>
                      {e.status.toLowerCase()}
                    </span>
                    {e.error && ` · ${e.error}`}
                    {" · "}{timeAgo(e.createdAt)}
                  </p>
                </div>
                <AdminEmailResendButton emailLogId={e.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
