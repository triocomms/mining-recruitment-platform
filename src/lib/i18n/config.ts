import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locale-config";

export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
} from "./locale-config";
export type { Locale } from "./locale-config";

/** Server-only: reads the candidate's language preference. Falls back to
 * English for anonymous visitors and anyone who hasn't picked a language
 * yet. Using cookies() opts the calling page into dynamic rendering, same
 * as the auth-gated pages already do. */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
