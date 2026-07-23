import Link from "next/link";
import { confirmEmailChangeToken } from "@/lib/verification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm email change — Orebridge" };

export default async function VerifyEmailChangePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const email = searchParams.token ? await confirmEmailChangeToken(searchParams.token) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {email ? (
        <>
          <p className="font-display text-4xl">✓</p>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-wide">Email updated</h1>
          <p className="mt-3 text-ink/70">
            <span className="font-semibold">{email}</span> is now your login email. Use it next time you sign in.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-block">Sign in →</Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired or invalid</h1>
          <p className="mt-3 text-ink/70">
            This confirmation link has already been used or has expired. Request the email change again
            from Account settings.
          </p>
          <Link href="/dashboard/settings" className="btn-ghost mt-6 inline-block">Go to Account settings</Link>
        </>
      )}
    </main>
  );
}
