import type { Metadata } from "next";
import { createElement as h } from "react";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact us",
};

export default function ContactPage() {
  return h(
    "main",
    { className: "mx-auto max-w-3xl px-4 py-8" },
    h("h1", { className: "font-display text-3xl uppercase tracking-wide" }, "Contact us"),
    h(
      "p",
      { className: "mt-2 text-sm text-ink/70" },
      "Questions, feedback, or something not working right? Send us a message below, or reach us directly using the details here."
      ),
    h(
      "div",
      { className: "mt-8 grid gap-10 sm:grid-cols-2" },
      h(
        "div",
        { key: "details" },
        h("h2", { className: "font-display text-lg uppercase tracking-wide text-ink/80" }, "Get in touch"),
        h(
          "dl",
          { className: "mt-4 space-y-4 text-sm" },
          h(
            "div",
            { key: "email" },
            h("dt", { className: "text-ink/50" }, "Email"),
            h("dd", { className: "mt-1" }, "[PLACEHOLDER: hello@fifodido.com]")
            ),
          h(
            "div",
            { key: "phone" },
            h("dt", { className: "text-ink/50" }, "Phone"),
            h("dd", { className: "mt-1" }, "[PLACEHOLDER: +61 0 0000 0000]")
            ),
          h(
            "div",
            { key: "address" },
            h("dt", { className: "text-ink/50" }, "Address"),
            h(
              "dd",
              { className: "mt-1" },
              "[PLACEHOLDER: Suite 0, 000 Example Street, Perth WA 6000, Australia]"
              )
            )
          )
        ),
      h(
        "div",
        { key: "form" },
        h(ContactForm, null)
        )
      )
    );
}
