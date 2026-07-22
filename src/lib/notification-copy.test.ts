import { describe, it, expect } from "vitest";
import { statusNotificationCopy, truncateForPreview } from "./notification-copy";

describe("statusNotificationCopy", () => {
  it("returns null for SUBMITTED (starting state, not a change)", () => {
    expect(statusNotificationCopy("SUBMITTED", "Fitter", "BHP")).toBeNull();
  });

  it("returns null for VIEWED (too frequent to be a useful signal)", () => {
    expect(statusNotificationCopy("VIEWED", "Fitter", "BHP")).toBeNull();
  });

  it("returns null for WITHDRAWN (candidate-initiated, nothing to tell them)", () => {
    expect(statusNotificationCopy("WITHDRAWN", "Fitter", "BHP")).toBeNull();
  });

  it("includes the job title and company name for SHORTLISTED", () => {
    const copy = statusNotificationCopy("SHORTLISTED", "Dragline Operator", "Peabody");
    expect(copy).not.toBeNull();
    expect(copy!.body).toContain("Dragline Operator");
    expect(copy!.body).toContain("Peabody");
  });

  it("includes the job title and company name for INTERVIEW", () => {
    const copy = statusNotificationCopy("INTERVIEW", "Dragline Operator", "Peabody");
    expect(copy!.body).toContain("Dragline Operator");
    expect(copy!.body).toContain("Peabody");
  });

  it("includes the job title and company name for OFFER", () => {
    const copy = statusNotificationCopy("OFFER", "Dragline Operator", "Peabody");
    expect(copy!.body).toContain("Dragline Operator");
    expect(copy!.body).toContain("Peabody");
  });

  it("keeps REJECTED short and respectful rather than over-explaining", () => {
    const copy = statusNotificationCopy("REJECTED", "Dragline Operator", "Peabody");
    expect(copy).not.toBeNull();
    expect(copy!.body.length).toBeLessThan(160);
    expect(copy!.body).toContain("Dragline Operator");
  });
});

describe("truncateForPreview", () => {
  it("returns short text unchanged", () => {
    expect(truncateForPreview("Hello there")).toBe("Hello there");
  });

  it("truncates long text at a word boundary and appends an ellipsis", () => {
    const long = "word ".repeat(60).trim();
    const result = truncateForPreview(long, 50);
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/); // no dangling space before the ellipsis
  });

  it("does not cut a single very long word mid-string without a safe space", () => {
    const long = "x".repeat(200);
    const result = truncateForPreview(long, 50);
    expect(result).toBe(`${"x".repeat(50)}…`);
  });

  it("trims surrounding whitespace before measuring length", () => {
    expect(truncateForPreview("   short   ", 50)).toBe("short");
  });
});
