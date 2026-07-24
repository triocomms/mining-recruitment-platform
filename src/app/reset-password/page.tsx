import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { checkPasswordResetToken } from "@/lib/verification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset your password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const valid = token ? await checkPasswordResetToken(token) : false;

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      {valid ? (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Choose a new password</h1>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <div className="text-center">
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired or invalid</h1>
          <p className="mt-3 text-ink/70">
            This password reset link has already been used or has expired. Request a fresh one below.
          </p>
          <Link href="/forgot-password" className="btn-primary mt-6 inline-block">Request a new link</Link>
        </div>
      )}
    </main>
  );
}
