import { RegisterForm } from "@/components/RegisterForm";

export const metadata = { title: "Create your free account" };

export default function RegisterPage({ searchParams }: { searchParams: { role?: string } }) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Join FiFoDiDo</h1>
      <p className="mt-1 text-sm text-ink/60">
        Free for candidates. Free for employers to register — pay only to post at volume.
      </p>
      <RegisterForm defaultRole={searchParams.role === "employer" ? "EMPLOYER" : "CANDIDATE"} />
    </div>
  );
}
