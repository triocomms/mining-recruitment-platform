import { RegisterForm } from "@/components/RegisterForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export const metadata = { title: "Create your free account" };

export default function RegisterPage({ searchParams }: { searchParams: { role?: string } }) {
  const dict = getDictionary(getLocale()).register;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">{dict.heading}</h1>
      <p className="mt-1 text-sm text-ink/60">
        {dict.subcopy}
      </p>
      <RegisterForm defaultRole={searchParams.role === "employer" ? "EMPLOYER" : "CANDIDATE"} dict={dict} />
    </div>
  );
}
