import Link from "next/link";
import { createElement as h } from "react";

const year = new Date().getFullYear();

export default function Footer() {
  return h(
    "footer",
    { className: "border-t border-ink-line bg-bone text-ink print:hidden" },
    h(
      "div",
      { className: "mx-auto max-w-5xl px-4 py-10 sm:px-6" },
      h(
        "div",
        { className: "grid grid-cols-2 gap-8 sm:grid-cols-4" },
        h(
          "div",
          { key: "company" },
          h("h3", { className: "font-display text-sm uppercase tracking-wide text-ink/60" }, "Company"),
          h(
            "ul",
            { className: "mt-3 space-y-2 text-sm" },
            h("li", { key: "about" }, h(Link, { href: "/about", className: "hover:text-hivis" }, "About us")),
            h("li", { key: "contact" }, h(Link, { href: "/contact", className: "hover:text-hivis" }, "Contact")),
            h("li", { key: "news" }, h(Link, { href: "/news", className: "hover:text-hivis" }, "News"))
            )
          ),
        h(
          "div",
          { key: "candidates" },
          h("h3", { className: "font-display text-sm uppercase tracking-wide text-ink/60" }, "For candidates"),
          h(
            "ul",
            { className: "mt-3 space-y-2 text-sm" },
            h("li", { key: "jobs" }, h(Link, { href: "/jobs", className: "hover:text-hivis" }, "Browse jobs")),
            h("li", { key: "salaries" }, h(Link, { href: "/salaries", className: "hover:text-hivis" }, "Salaries"))
            )
          ),
        h(
          "div",
          { key: "legal" },
          h("h3", { className: "font-display text-sm uppercase tracking-wide text-ink/60" }, "Legal"),
          h(
            "ul",
            { className: "mt-3 space-y-2 text-sm" },
            h("li", { key: "privacy" }, h(Link, { href: "/privacy", className: "hover:text-hivis" }, "Privacy")),
            h("li", { key: "terms" }, h(Link, { href: "/terms", className: "hover:text-hivis" }, "Terms"))
            )
          )
        ),
      h("div", { className: "strata mt-8", "aria-hidden": true }),
      h(
        "div",
        { className: "mt-6 flex flex-col gap-2 text-xs text-ink/60 sm:flex-row sm:items-center sm:justify-between" },
        h("p", { key: "copyright" }, "\u00a9 " + year + " FiFoDiDo. All rights reserved."),
        h(
          "p",
          { key: "entity" },
          "[PLACEHOLDER: FiFoDiDo is operated by [Company Pty Ltd], ABN [00 000 000 000].]"
          )
        )
      )
    );
}
