import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Capture which were unread *before* this visit marks them read, so this
  // render can still highlight what's new — otherwise every row would look
  // identical the instant the page finished loading.
  const wasUnread = new Set(notifications.filter((n) => !n.readAt).map((n) => n.id));
  if (wasUnread.size > 0) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Notifications</h1>
      <p className="mt-1 text-sm text-ink/60">
        Application status changes, new messages, and saved-search matches all land here.
      </p>

      {notifications.length === 0 ? (
        <p className="card mt-6 text-sm text-ink/60">Nothing here yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {notifications.map((n) => {
            const unread = wasUnread.has(n.id);
            const body = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{n.title}</span>
                  <span className="shrink-0 text-xs text-ink/50">{timeAgo(n.createdAt)}</span>
                </div>
                <p className={`mt-1 text-sm ${unread ? "" : "text-ink/60"}`}>{n.body}</p>
              </>
            );
            const className = `card block ${unread ? "border-l-4 border-l-oregold" : ""}`;
            return (
              <li key={n.id}>
                {n.linkUrl ? (
                  <Link href={n.linkUrl} className={className}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
