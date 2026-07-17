import Link from "next/link";
import { verifyEmailToken } from "@/lib/verification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email — Orebridge" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const email = searchParams.token ? await verifyEmailToken(searchParams.token) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {email ? (
        <>
          <p className="font-display text-4xl">✓</p>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-wide">Email verified</h1>
          <p className="mt-3 text-ink/70">
            <span className="font-semibold">{email}</span> is confirmed. You can now sign in.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-block">Sign in →</Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired or invalid</h1>
          <p className="mt-3 text-ink/70">
            This verification link has already been used or has expired. Request a fresh one from
            the sign-in page.
          </p>
          <Link href="/login" className="btn-ghost mt-6 inline-block">Go to sign in</Link>
        </>
      )}
    </main>
  );
}
