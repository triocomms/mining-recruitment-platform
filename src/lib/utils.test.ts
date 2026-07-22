import { describe, it, expect } from "vitest";
import { dedupeLocationLabels } from "./utils";

describe("dedupeLocationLabels", () => {
  it("formats and de-dupes city/region/country combinations", () => {
    const jobs = [
      { city: "Perth", region: "WA", countryCode: "AU" },
      { city: "Perth", region: "WA", countryCode: "AU" }, // duplicate
      { city: "Brisbane", region: "QLD", countryCode: "AU" },
    ];
    expect(dedupeLocationLabels(jobs, 10)).toEqual(["Perth, WA, AU", "Brisbane, QLD, AU"]);
  });

  it("drops rows that would render as 'Location not specified'", () => {
    const jobs = [
      { city: null, region: null, countryCode: null },
      { city: null, region: null, countryCode: "ZZ" }, // unresolved sentinel
      { city: "Perth", region: "WA", countryCode: "AU" },
    ];
    expect(dedupeLocationLabels(jobs, 10)).toEqual(["Perth, WA, AU"]);
  });

  it("preserves input order", () => {
    const jobs = [
      { city: "Brisbane", region: "QLD", countryCode: "AU" },
      { city: "Perth", region: "WA", countryCode: "AU" },
    ];
    expect(dedupeLocationLabels(jobs, 10)).toEqual(["Brisbane, QLD, AU", "Perth, WA, AU"]);
  });

  it("stops once max results is reached", () => {
    const jobs = [
      { city: "A", region: "R", countryCode: "AU" },
      { city: "B", region: "R", countryCode: "AU" },
      { city: "C", region: "R", countryCode: "AU" },
    ];
    expect(dedupeLocationLabels(jobs, 2)).toEqual(["A, R, AU", "B, R, AU"]);
  });

  it("handles a job with only a country resolved", () => {
    const jobs = [{ city: null, region: null, countryCode: "AU" }];
    expect(dedupeLocationLabels(jobs, 10)).toEqual(["AU"]);
  });

  it("returns an empty array for no input", () => {
    expect(dedupeLocationLabels([], 10)).toEqual([]);
  });
});
