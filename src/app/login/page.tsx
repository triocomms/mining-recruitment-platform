import { LoginForm } from "@/components/LoginForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const dict = getDictionary(getLocale()).login;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">{dict.heading}</h1>
      <LoginForm dict={dict} />
      <p className="mt-4 text-sm text-ink/60">
        {dict.newHerePre}<a href="/register" className="font-semibold text-oxide underline">{dict.createFreeAccount}</a>
      </p>
    </div>
  );
}
