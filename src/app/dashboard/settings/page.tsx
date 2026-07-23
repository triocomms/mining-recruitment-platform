import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/AccountSettingsForm";

// Deliberately outside /dashboard/candidate, /dashboard/employer, and
// /dashboard/admin — middleware.ts only role-redirects those three prefixes,
// so this single page works unmodified for every signed-in role.
export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, pendingEmail: true },
  });
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Account settings</h1>
      <p className="mt-1 text-sm text-ink/60">Update the email and password you use to sign in.</p>

      <div className="mt-6">
        <AccountSettingsForm currentEmail={user.email} pendingEmail={user.pendingEmail} />
      </div>
    </main>
  );
}
