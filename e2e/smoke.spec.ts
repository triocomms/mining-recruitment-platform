import { test, expect } from "@playwright/test";

/**
 * Smoke tests only: confirm the app actually boots and serves its core
 * public pages without erroring. This is the class of failure that bit us
 * recently (a build that silently broke and kept serving a stale
 * deployment) — these tests are the last line of defense that would have
 * caught it before it shipped.
 */

test("homepage loads", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/fifodido/i);
});

test("jobs listing page loads and renders the search form", async ({ page }) => {
  const res = await page.goto("/jobs");
  expect(res?.ok()).toBeTruthy();
  await expect(page.getByText(/live jobs/i)).toBeVisible();
});

test("pricing page loads", async ({ page }) => {
  const res = await page.goto("/pricing");
  expect(res?.ok()).toBeTruthy();
});

test("news/blog listing page loads", async ({ page }) => {
  const res = await page.goto("/news");
  expect(res?.ok()).toBeTruthy();
});

test("login page loads", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res?.ok()).toBeTruthy();
});

test("an unknown route renders a 404 rather than crashing", async ({ page }) => {
  const res = await page.goto("/this-route-does-not-exist-xyz");
  expect(res?.status()).toBe(404);
});
