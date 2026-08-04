import type { Metadata } from "next";
import Link from "next/link";
import { createElement as h } from "react";

export const metadata: Metadata = {
  title: "About us",
  description: "Who's behind FiFoDiDo and why we built a job board just for mining and resources.",
};

export default function AboutPage() {
  return h(
    "main",
    { className: "mx-auto max-w-2xl px-4 py-10" },
    h("h1", { className: "font-display text-4xl uppercase tracking-wide" }, "About FiFoDiDo"),
    h(
      "p",
      { className: "mt-2 text-ink/70" },
      "[PLACEHOLDER: one or two lines on why FiFoDiDo exists, replace with real copy.]"
      ),
    h("div", { className: "strata mt-6", "aria-hidden": true }),
    h(
      "section",
      { className: "mt-8 space-y-6 text-ink/85" },
      h(
        "div",
        { key: "story" },
        h("h2", { className: "font-display text-2xl uppercase tracking-wide" }, "Our story"),
        h(
          "p",
          { className: "mt-2 text-sm leading-relaxed" },
          "[PLACEHOLDER: origin story, why you started FiFoDiDo, what problem you saw in mining recruitment, and how it grew from Orebridge into what it is today.]"
          )
        ),
      h(
        "div",
        { key: "different" },
        h("h2", { className: "font-display text-2xl uppercase tracking-wide" }, "What makes us different"),
        h(
          "p",
          { className: "mt-2 text-sm leading-relaxed" },
          "[PLACEHOLDER: FIFO-specific differentiation, rosters, camp life, travel logistics, point-of-hire allowances, the things generic job boards do not cover.]"
          )
        ),
      h(
        "div",
        { key: "team" },
        h("h2", { className: "font-display text-2xl uppercase tracking-wide" }, "Our team"),
        h(
          "p",
          { className: "mt-2 text-sm leading-relaxed" },
          "[PLACEHOLDER: founder and team bios go here.]"
          )
        ),
      h(
        "div",
        { key: "company" },
        h("h2", { className: "font-display text-2xl uppercase tracking-wide" }, "Company details"),
        h(
          "p",
          { className: "mt-2 text-sm leading-relaxed" },
          '[PLACEHOLDER: legal entity name and ABN, e.g. "FiFoDiDo is operated by [Company Pty Ltd], ABN [00 000 000 000]."]'
          )
        )
      ),
    h("div", { className: "strata mt-8", "aria-hidden": true }),
    h(
      "p",
      { className: "mt-8 text-sm text-ink/70" },
      "Got a question, or want to say hello? ",
      h(Link, { href: "/contact", className: "text-hivis hover:underline" }, "Get in touch"),
      "."
      )
    );
}
