import { describe, it, expect } from "vitest";
import { shouldCheckSavedSearchToday } from "./saved-search-frequency";

const NOW = new Date("2026-07-22T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

describe("shouldCheckSavedSearchToday", () => {
  it("always checks a DAILY search, even if notified minutes ago", () => {
    const justNow = new Date(NOW.getTime() - 60_000);
    expect(shouldCheckSavedSearchToday("DAILY", justNow, NOW)).toBe(true);
  });

  it("always checks a DAILY search with no prior notification", () => {
    expect(shouldCheckSavedSearchToday("DAILY", null, NOW)).toBe(true);
  });

  it("checks a WEEKLY search that has never been notified (first run)", () => {
    expect(shouldCheckSavedSearchToday("WEEKLY", null, NOW)).toBe(true);
  });

  it("skips a WEEKLY search notified 3 days ago", () => {
    expect(shouldCheckSavedSearchToday("WEEKLY", daysAgo(3), NOW)).toBe(false);
  });

  it("skips a WEEKLY search notified just under 7 days ago", () => {
    expect(shouldCheckSavedSearchToday("WEEKLY", daysAgo(6.9), NOW)).toBe(false);
  });

  it("checks a WEEKLY search notified exactly 7 days ago", () => {
    expect(shouldCheckSavedSearchToday("WEEKLY", daysAgo(7), NOW)).toBe(true);
  });

  it("checks a WEEKLY search notified well over 7 days ago", () => {
    expect(shouldCheckSavedSearchToday("WEEKLY", daysAgo(10), NOW)).toBe(true);
  });
});
