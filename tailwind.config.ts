import type { Config } from "tailwindcss";

/**
 * Orebridge design tokens.
 * Palette drawn from a drill-core sample: ink (host rock), iron oxide,
 * ore gold, copper patina, and hi-vis amber for primary actions.
 * Mobile-first: base styles target ~380px, scale up from `sm:`.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#171B21", soft: "#232932", line: "#2F3742" },
        bone: { DEFAULT: "#F5F3EE", soft: "#EAE7DF" },
        oxide: "#A6432A",
        oregold: "#C99A3B",
        patina: "#3E8E7E",
        hivis: { DEFAULT: "#F5A300", deep: "#C98600" },
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
