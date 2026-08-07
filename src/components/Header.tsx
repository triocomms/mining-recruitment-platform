import Link from "next/link";
import { createElement as h, Fragment } from "react";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";

export async function Header() {
    const session = await auth();
    const user = session?.user;
    const dashboardHref =
          user?.role === "ADMIN"
        ? "/dashboard/admin"
            : user?.role === "EMPLOYER"
          ? "/dashboard/employer"
              : "/dashboard/candidate";

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
                          h(Link, { href: "/jobs", className: "rounded px-2 py-1 hover:text-hivis" }, "Jobs"),
                          h(Link, { href: "/sites", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, "Sites"),
                          h(Link, { href: "/companies", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, "Companies"),
                          h(Link, { href: "/salaries", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, "Salaries"),
                          h(Link, { href: "/news", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, "News"),
                          h(Link, { href: "/pricing", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" }, "Pricing"),
                          user
                            ? h(
                                            Fragment,
                                            null,
                                            h(NotificationBell, null),
                                            h(
                                                              Link,
                                              { href: "/dashboard/settings", className: "hidden rounded px-2 py-1 hover:text-hivis sm:block" },
                                                              "Account"
                                                            ),
                                            h(SignOutButton, null),
                                            h(Link, { href: dashboardHref, className: "btn-primary !px-3 !py-1.5" }, "Dashboard")
                                          )
                            : h(
                                            Fragment,
                                            null,
                                            h(Link, { href: "/login", className: "rounded px-2 py-1 hover:text-hivis" }, "Sign in"),
                                            h(Link, { href: "/register", className: "btn-primary !px-3 !py-1.5" }, "Join free")
                                          )
                        )
              )
      );
}
