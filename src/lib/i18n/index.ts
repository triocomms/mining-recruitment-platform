import type { Locale } from "./config";
import en from "./dictionaries/en";
import tl from "./dictionaries/tl";
import id from "./dictionaries/id";
import vi from "./dictionaries/vi";
import zh from "./dictionaries/zh";

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, tl, id, vi, zh };

/** Looks up the full translation dictionary for a locale. Server components
 *  pair this with getLocale() from ./config; client components receive the
 *  relevant slice as a prop from whichever server component rendered them,
 *  since next/headers cookies() (which getLocale() relies on) isn't
 *  available client-side. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, getLocale } from "./config";
export type { Locale } from "./config";
