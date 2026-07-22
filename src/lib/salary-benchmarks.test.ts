import { describe, expect, it } from "vitest";
import {
  ABS_AVERAGE_WEEKLY_EARNINGS,
  MINING_AWARD_LEVELS,
  weeklyToAnnual,
} from "./salary-benchmarks";

describe("weeklyToAnnual", () => {
  it("multiplies by 52 and rounds to the nearest dollar", () => {
    expect(weeklyToAnnual(1000)).toBe(52000);
    expect(weeklyToAnnual(3174.4)).toBe(165069); // 3174.40 * 52 = 165068.8
  });
});

describe("MINING_AWARD_LEVELS", () => {
  it("has 7 levels in ascending order with increasing pay", () => {
    expect(MINING_AWARD_LEVELS).toHaveLength(7);
    for (let i = 1; i < MINING_AWARD_LEVELS.length; i++) {
      expect(MINING_AWARD_LEVELS[i].level).toBe(MINING_AWARD_LEVELS[i - 1].level + 1);
      expect(MINING_AWARD_LEVELS[i].weekly).toBeGreaterThan(MINING_AWARD_LEVELS[i - 1].weekly);
      expect(MINING_AWARD_LEVELS[i].hourly).toBeGreaterThan(MINING_AWARD_LEVELS[i - 1].hourly);
    }
  });
});

describe("ABS_AVERAGE_WEEKLY_EARNINGS", () => {
  it("shows mining earning above the all-industries average", () => {
    expect(ABS_AVERAGE_WEEKLY_EARNINGS.miningPersons).toBeGreaterThan(
      ABS_AVERAGE_WEEKLY_EARNINGS.allIndustriesPersons
    );
  });
});
