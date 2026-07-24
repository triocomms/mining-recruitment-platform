// Static, citable public benchmarks for the /salaries page — deliberately
// separate from the live-job-ad figures computed in src/app/salaries/*.
// These numbers are NOT derived from FiFoDiDo job ads. They come from two
// primary sources and should only ever be updated by re-checking those
// sources, not estimated or interpolated.
//
// 1. Fair Work Ombudsman — Mining Industry Award 2020 (MA000011), minimum
//    rates and classifications (clause 15). Award minimums are reviewed
//    annually and take effect from the first full pay period on or after
//    1 July each year.
// 2. Australian Bureau of Statistics — Average Weekly Earnings, Australia
//    (cat. no. 6302.0), full-time adult ordinary time earnings by industry.
//    Released twice yearly (~Feb for the November reference period, ~Aug
//    for the May reference period).
//
// When refreshing: re-check both source URLs, update the figures and the
// `asOf` / `referencePeriod` fields together, and update `lastChecked`.

export const MINING_AWARD_SOURCE = {
  name: "Fair Work Ombudsman — Mining Industry Award 2020 (MA000011)",
  url: "https://awards.fairwork.gov.au/MA000011.html",
  asOf: "1 July 2026",
};

export const MINING_AWARD_LEVELS = [
  { level: 1, classification: "Basic", weekly: 1047.30, hourly: 27.56 },
  { level: 2, classification: "Intermediate", weekly: 1086.20, hourly: 28.58 },
  { level: 3, classification: "Competent", weekly: 1119.10, hourly: 29.45 },
  { level: 4, classification: "Advanced", weekly: 1193.90, hourly: 31.42 },
  { level: 5, classification: "Advanced specialist", weekly: 1271.80, hourly: 33.47 },
  { level: 6, classification: "Dual trade", weekly: 1334.10, hourly: 35.11 },
  { level: 7, classification: "Dual trade instrumentation", weekly: 1388.10, hourly: 36.53 },
] as const;

export const ABS_EARNINGS_SOURCE = {
  name: "Australian Bureau of Statistics — Average Weekly Earnings, Australia",
  url: "https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/average-weekly-earnings-australia/latest-release",
  referencePeriod: "November 2025",
  released: "26 February 2026",
};

// Full-time adult ordinary time earnings, original series, by industry.
export const ABS_AVERAGE_WEEKLY_EARNINGS = {
  miningPersons: 3174.40,
  miningMales: 3267.60,
  miningFemales: 2813.70,
  allIndustriesPersons: 2051.10,
};

export const BENCHMARKS_LAST_CHECKED = "22 July 2026";

export function weeklyToAnnual(weekly: number): number {
  return Math.round(weekly * 52);
}
