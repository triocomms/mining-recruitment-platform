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
        // "oxide" = brand secondary (coral) — also used for negative/
        // rejected/error state. `deep` is the brand guide's coral hover/
        // text-on-tint shade, for buttons, headings and decorative accents.
        oxide: { DEFAULT: "#D85A30", deep: "#993C1D" },
        // "oregold" = pending/warning state, and the brand guide's coral
        // bg-strong tint for accent chips/badges/borders.
        oregold: "#F5C4B3",
        // "patina" = verified/success state → brand primary (teal).
        patina: "#0F6E56",
        // "hivis" = primary CTA colour → brand primary (teal). `light` is
        // the brand guide's teal bg-strong tint, for tinted borders/badges.
        hivis: { DEFAULT: "#0F6E56", deep: "#085041", light: "#9FE1CB" },
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
