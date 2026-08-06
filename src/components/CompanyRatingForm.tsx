"use client";

import { useState } from "react";
import { createElement as h } from "react";
import { useRouter } from "next/navigation";
import { RATING_CATEGORIES, type Scores } from "@/lib/ratingCategories";

const EMPTY_SCORES: Scores = {
    rosterRotation: 0,
    accommodation: 0,
    food: 0,
    downtimeFacilities: 0,
    travelLogistics: 0,
    safetyCulture: 0,
};

function StarRow(props: { label: string; value: number; onChange: (n: number) => void }) {
    return h(
          "div",
      { className: "flex items-center justify-between gap-3" },
          h("span", { className: "text-sm text-ink/80" }, props.label),
          h(
                  "div",
            { className: "flex items-center gap-0.5", role: "radiogroup", "aria-label": props.label },
                  ...[1, 2, 3, 4, 5].map((n) =>
                            h(
                                        "button",
                              {
                                            key: n,
                                            type: "button",
                                            role: "radio",
                                            "aria-checked": props.value === n,
                                            "aria-label": `${n} star${n === 1 ? "" : "s"}`,
                                            className: `text-xl leading-none ${n <= props.value ? "text-oregold" : "text-ink/20"}`,
                                            onClick: () => props.onChange(n),
                              },
                                        "★"
                                      )
                                               )
                )
        );
}

export function CompanyRatingForm(props: { companyId: string; existing?: Scores | null }) {
    const router = useRouter();
    const [scores, setScores] = useState<Scores>(props.existing ?? EMPTY_SCORES);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

  const allScored = RATING_CATEGORIES.every((c) => scores[c.key] > 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/company-ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyId: props.companyId, ...scores }),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (res.ok) {
                setDone(true);
                router.refresh();
        } else {
                setError(data.error ?? "Could not save rating");
        }
  }

  if (done) {
        return h("p", { className: "card text-sm text-patina" }, "✓ Thanks — your rating is live.");
  }

  return h(
        "form",
    { onSubmit: submit, className: "card space-y-3" },
        h("p", { className: "label" }, props.existing ? "Update your rating" : "Rate this employer"),
        ...RATING_CATEGORIES.map((c) =>
                h(StarRow, {
                          key: c.key,
                          label: c.label,
                          value: scores[c.key],
                          onChange: (n: number) => setScores((s) => ({ ...s, [c.key]: n })),
                })
                                     ),
        h(
                "button",
          { type: "submit", className: "btn-primary w-full", disabled: busy || !allScored },
                busy ? "Saving…" : props.existing ? "Update rating" : "Post rating"
              ),
        error && h("p", { className: "text-xs text-oxide" }, error)
      );
}
