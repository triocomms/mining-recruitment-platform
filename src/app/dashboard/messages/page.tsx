import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const threads = await prisma.messageThread.findMany({
    where:
      user.role === "EMPLOYER"
        ? { company: { ownerId: user.id } }
        : { candidate: { userId: user.id } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      company: { select: { name: true } },
      candidate: { select: { firstName: true, lastName: true, userId: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Messages</h1>
      <p className="mt-1 text-sm text-ink/60">
        {user.role === "CANDIDATE"
          ? "Conversations with companies you've applied to, or who reached out to you."
          : "Conversations with candidates. New outreach is limited by your plan's daily cap."}
      </p>

      {threads.length === 0 ? (
        <p className="card mt-6 text-sm text-ink/60">No conversations yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {threads.map((t) => {
            const counterpart =
              user.role === "EMPLOYER"
                ? `${t.candidate.firstName} ${t.candidate.lastName}`
                : t.company.name;
            const last = t.messages[0];
            const unread = last && !last.readAt && last.senderUserId !== user.id;
            return (
              <li key={t.id}>
                <Link href={`/dashboard/messages/${t.id}`} className={`card block ${unread ? "border-l-4 border-l-oregold" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${unread ? "" : ""}`}>{counterpart}</span>
                    <span className="text-xs text-ink/50">{timeAgo(t.updatedAt)}</span>
                  </div>
                  {last && (
                    <p className={`mt-1 truncate text-sm ${unread ? "font-semibold" : "text-ink/60"}`}>
                      {last.senderUserId === user.id ? "You: " : ""}{last.body}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
