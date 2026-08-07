import { cookies } from "next/headers";

/**
 * Candidate-facing language support. Scope is deliberately narrow: static UI
 * strings (buttons, labels, headings, form copy) across the public job
 * board and the candidate dashboard. Employer- and admin-authored content --
 * job titles, descriptions, company names -- is never translated, and the
 * employer/admin dashboards stay English-only, since this is aimed at the
 * candidate side of a global mining workforce rather than at employers.
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

function isLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Server-only: reads the candidate's language preference. Falls back to
 *  English for anonymous visitors and anyone who hasn't picked a language
 *  yet. Using cookies() opts the calling page into dynamic rendering, same
 *  as the auth-gated pages already do. */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
