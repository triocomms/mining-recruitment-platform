import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export default async function AdminContactMessagesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Contact messages</h1>
        <Link href="/dashboard/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <div className="card mt-6 divide-y divide-ink/10 p-0">
        {messages.length === 0 && <p className="p-4 text-sm text-ink/60">No messages yet.</p>}
        {messages.map((m) => (
          <Link
            key={m.id}
            href={`/dashboard/admin/contact/${m.id}`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-ink/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{m.subject}</p>
              <p className="truncate text-xs text-ink/60">
                {m.name} &lt;{m.email}&gt; · {timeAgo(m.createdAt)}
              </p>
            </div>
            <span className={`tag ${m.status === "NEW" ? "bg-oxide/15 text-oxide" : "bg-patina/15 text-patina"}`}>
              {m.status === "NEW" ? "New" : "Replied"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
