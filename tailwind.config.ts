import type { Config } from "tailwindcss";

/**
 * FiFoDiDo design tokens.
 * Two brand colours only: teal (primary, always-there CTA/nav/link colour)
 * and coral (secondary, reserved for warmth/promo/highlight use — see
 * BRAND_GUIDE.md). Existing utility class names (ink/bone/oxide/oregold/
 * patina/hivis) are kept as internal aliases so every component that
 * already uses them site-wide picks up the new palette automatically —
 * only the hex values below changed, not the class names.
 * Mobile-first: base styles target ~380px, scale up from `sm:`.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "ink" = body text / neutral ink (was near-black host-rock tone,
        // now the brand guide's --text-primary).
        ink: { DEFAULT: "#2C2C2A", soft: "#5F5E5A", line: "#D3D1C7" },
        // "bone" = page/card surface (was cream, now always white per
        // brand guide — "no dark mode variant needed for this site").
        bone: { DEFAULT: "#FFFFFF", soft: "#FFFFFF" },
        // "oxide" = negative/rejected/error state → brand secondary (coral).
        oxide: "#D85A30",
        // "oregold" = pending/warning state → a lighter coral tint, kept
        // visually distinct from the solid-coral "oxide" error tone without
        // introducing a third brand hue.
        oregold: "#F5C4B3",
        // "patina" = verified/success state → brand primary (teal).
        patina: "#0F6E56",
        // "hivis" = primary CTA colour → brand primary (teal).
        hivis: { DEFAULT: "#0F6E56", deep: "#085041" },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: { card: "0.875rem" },
    },
  },
  plugins: [],
};
export default config;
