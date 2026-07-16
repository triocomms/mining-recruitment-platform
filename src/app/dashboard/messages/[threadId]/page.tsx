import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageComposer } from "@/components/MessageComposer";

export default async function ThreadPage({ params }: { params: { threadId: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const thread = await prisma.messageThread.findUnique({
    where: { id: params.threadId },
    include: {
      company: { select: { name: true, slug: true, ownerId: true } },
      candidate: { select: { firstName: true, lastName: true, userId: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!thread) notFound();

  const isMember = thread.company.ownerId === user.id || thread.candidate.userId === user.id;
  if (!isMember && user.role !== "ADMIN") notFound();

  // Mark counterpart messages as read.
  await prisma.message.updateMany({
    where: { threadId: thread.id, senderUserId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const counterpart =
    thread.company.ownerId === user.id
      ? `${thread.candidate.firstName} ${thread.candidate.lastName}`
      : thread.company.name;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/messages" className="text-sm text-ink/50 hover:underline">← All messages</Link>
          <h1 className="font-display text-2xl uppercase tracking-wide">{counterpart}</h1>
          {thread.candidate.userId !== user.id && (
            <p className="text-xs text-ink/50">
              Candidate conversations are private. Do not request payment or personal documents through chat.
            </p>
          )}
        </div>
        {thread.company.ownerId !== user.id && (
          <Link href={`/companies/${thread.company.slug}`} className="text-sm underline">
            Company page
          </Link>
        )}
      </div>

      <div className="mt-6 flex-1 space-y-3">
        {thread.messages.map((m) => {
          const mine = m.senderUserId === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  mine ? "bg-ink text-bone" : "bg-white shadow-sm ring-1 ring-ink/10"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? "text-bone/60" : "text-ink/40"}`}>
                  {m.createdAt.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-6 bg-bone/95 pb-2 pt-2 backdrop-blur">
        <MessageComposer threadId={thread.id} />
      </div>
    </main>
  );
}
