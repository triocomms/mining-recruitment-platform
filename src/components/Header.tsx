import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";

export async function Header() {
  const session = await auth();
  const user = session?.user;
  const dashboardHref =
    user?.role === "ADMIN"
      ? "/dashboard/admin"
      : user?.role === "EMPLOYER"
        ? "/dashboard/employer"
        : "/dashboard/candidate";

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line bg-ink text-bone">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-bold uppercase tracking-wide">
          Ore<span className="text-hivis">bridge</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link href="/jobs" className="rounded px-2 py-1 hover:text-hivis">Jobs</Link>
          <Link href="/salaries" className="hidden rounded px-2 py-1 hover:text-hivis sm:block">Salaries</Link>
          <Link href="/news" className="hidden rounded px-2 py-1 hover:text-hivis sm:block">News</Link>
          <Link href="/pricing" className="hidden rounded px-2 py-1 hover:text-hivis sm:block">Pricing</Link>
          {user ? (
            <>
              <NotificationBell />
              <Link href="/dashboard/settings" className="hidden rounded px-2 py-1 hover:text-hivis sm:block">Account</Link>
              <SignOutButton />
              <Link href={dashboardHref} className="btn-primary !px-3 !py-1.5">Dashboard</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded px-2 py-1 hover:text-hivis">Sign in</Link>
              <Link href="/register" className="btn-primary !px-3 !py-1.5">Join free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
