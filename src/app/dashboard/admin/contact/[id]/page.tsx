import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminContactReplyForm } from "@/components/AdminActions";

export default async function AdminContactMessagePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const message = await prisma.contactMessage.findUnique({ where: { id: params.id } });
  if (!message) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Contact message</h1>
        <Link href="/dashboard/admin/contact" className="text-sm underline">Back to messages</Link>
      </div>

      <div className="card mt-6 space-y-3">
        <div>
          <p className="text-sm font-semibold">{message.subject}</p>
          <p className="text-xs text-ink/60">
            From {message.name} &lt;{message.email}&gt; · {message.createdAt.toLocaleString("en-AU")}
          </p>
        </div>
        <p className="whitespace-pre-wrap text-sm">{message.message}</p>
      </div>

      {message.status === "REPLIED" ? (
        <div className="card mt-4 space-y-2">
          <p className="label">
            Reply sent {message.repliedAt ? message.repliedAt.toLocaleString("en-AU") : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm">{message.adminReply}</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="label mb-2">Reply to {message.name}</p>
          <AdminContactReplyForm messageId={message.id} />
        </div>
      )}
    </main>
  );
}
