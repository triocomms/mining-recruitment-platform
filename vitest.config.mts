import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Unit tests only — see playwright.config.ts for e2e. Kept to Node
 * environment since the current test suite targets server-side business
 * logic (quota, visibility, rate limiting, CSV/RSS parsing), not React
 * components.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
