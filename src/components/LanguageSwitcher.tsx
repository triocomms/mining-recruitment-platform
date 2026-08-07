"use client";

import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/lib/i18n/locale-config";

/** Plain <select> to match the rest of the app -- there's no dropdown/menu
 *  primitive here beyond native selects (see every filter/form in the app).
 *  Setting the cookie and calling router.refresh() re-renders every server
 *  component (this one included, via a fresh Header render) with the new
 *  locale -- no client-side translation state to keep in sync. */
export function LanguageSwitcher({ currentLocale, label }: { currentLocale: Locale; label: string }) {
  const router = useRouter();

  function changeLocale(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <select
      value={currentLocale}
      onChange={changeLocale}
      aria-label={label}
      className="rounded border-0 bg-transparent px-1 py-1 text-sm hover:text-hivis focus:outline-none focus:ring-1 focus:ring-hivis"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_LABELS[locale]}
        </option>
      ))}
    </select>
  );
}
