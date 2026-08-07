/**
 * Candidate-facing language support. Scope is deliberately narrow: static UI
 * strings (buttons, labels, headings, form copy) across the public job
 * board and the candidate dashboard. Employer- and admin-authored content --
 * job titles, descriptions, company names -- is never translated, and the
 * employer/admin dashboards stay English-only, since this is aimed at the
 * candidate side of a global mining workforce rather than at employers.
 *
 * Split out from config.ts so client components (e.g. LanguageSwitcher) can
 * import these plain constants without pulling in next/headers -- Next.js
 * treats any module that imports next/headers as server-only, even if the
 * client bundle never calls the function that uses it.
 */
export const SUPPORTED_LOCALES = ["en", "tl", "id", "vi", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  tl: "Tagalog",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  zh: "中文",
};

// Plain cookie, no DB column: a candidate's language choice doesn't need to
// follow them across devices the way their profile does, and every other
// piece of client-remembered state in this app (see ConsentBanner) already
// uses a plain cookie rather than a library or localStorage.
export const LOCALE_COOKIE = "fifodido_lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
