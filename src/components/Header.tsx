import Link from "next/link";
import { createElement as h, Fragment } from "react";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getLocale, getDictionary } from "@/lib/i18n";

export async function Header() {
    const session = await auth();
    const user = session?.user;
    const dashboardHref =
          user?.role === "ADMIN"
        ? "/dashboard/admin"
            : user?.role === "EMPLOYER"
          ? "/dashboard/employer"
              : "/dashboard/candidate";

  const locale = getLocale();
  const dict = getDictionary(locale).header;
  // Language support is candidate-facing only (see src/lib/i18n/config.ts) --
  // employers and admins never see the switcher, so their dashboards stay
  // English by construction rather than every page separately checking role.
  const showLanguageSwitcher = user?.role !== "EMPLOYER" && user?.role !== "ADMIN";

  return h(
        "header",
    { className: "sticky top-0 z-40 border-b border-ink-line bg-bone text-ink print:hidden" },
        h(
                "div",
          { className: "mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6" },
                h(
                          Link,
                  { href: "/", className: "flex items-center" },
                          h("img", { src: "/fifodido-logo.svg", alt: "FiFoDiDo", className: "h-8 w-auto sm:h-9" })
                        ),
                h(
                          "nav",
                  { className: "flex items-center gap-2 text-sm sm:gap-4" },
                          h(Link, { href: "/jobs", className: "rounded px-2 py-1 hover:text-hivis" }, dict.navJobs),
                          h(Link, { href: "/sites", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, dict.navSites),
                          h(Link, { href: "/companies", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, dict.navCompanies),
                          h(Link, { href: "/salaries", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, dict.navSalaries),
                          h(Link, { href: "/news", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, dict.navNews),
                          h(Link, { href: "/pricing", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, dict.navPricing),
                          showLanguageSwitcher
                            ? h(LanguageSwitcher, { currentLocale: locale, label: dict.languageLabel })
                            : null,
                          user
                            ? h(
                                            Fragment,
                                            null,
                                            h(NotificationBell, null),
                                            h(
                                                              Link,
                                              { href: "/dashboard/settings", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" },
                                                              dict.account
                                                            ),
                                            h(SignOutButton, null),
                                            h(Link, { href: dashboardHref, className: "btn-primary !px-3 !py-1.5" }, dict.dashboard)
                                          )
                            : h(
                                            Fragment,
                                            null,
                                            h(Link, { href: "/login", className: "rounded px-2 py-1 hover:text-hivis" }, dict.signIn),
                                            h(Link, { href: "/register", className: "btn-primary !px-3 !py-1.5" }, dict.joinFree)
                                          )
                        )
              )
      );
}
