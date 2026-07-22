import { defineConfig } from "@playwright/test";

/**
 * Minimal e2e smoke suite — establishes the harness against real HTTP
 * responses (a build/runtime break like the recent silent route.ts export
 * failure shows up here even if unit tests all pass) rather than trying to
 * cover every flow up front. Expand test files under e2e/ as coverage grows.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
