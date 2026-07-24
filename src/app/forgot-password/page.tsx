import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Forgot your password?</h1>
      <p className="mt-2 text-sm text-ink/60">
        Enter the email you signed up with and we&rsquo;ll send you a link to reset your password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-4 text-sm text-ink/60">
        <Link href="/login" className="font-semibold text-oxide underline">Back to sign in</Link>
      </p>
    </div>
  );
}
