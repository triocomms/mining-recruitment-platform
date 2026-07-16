import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Sign in</h1>
      <LoginForm />
      <p className="mt-4 text-sm text-ink/60">
        New here? <a href="/register" className="font-semibold text-oxide underline">Create a free account</a>
      </p>
    </div>
  );
}
