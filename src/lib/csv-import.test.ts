import { describe, it, expect } from "vitest";
import { parseJobsCsv } from "./csv-import";

const COLUMNS = [
  "title",
  "description",
  "country_code",
  "region",
  "city",
  "employment_type",
  "commodity",
  "site_type",
  "role_category",
  "fifo",
  "roster_pattern",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_period",
  "apply_url",
  "external_ref",
] as const;

const HEADER = COLUMNS.join(",");

const DEFAULTS: Record<(typeof COLUMNS)[number], string> = {
  title: "Fitter",
  description: "Long enough description for validation purposes here past thirty characters.",
  country_code: "AU",
  region: "",
  city: "",
  employment_type: "",
  commodity: "",
  site_type: "",
  role_category: "",
  fifo: "",
  roster_pattern: "",
  salary_min: "",
  salary_max: "",
  salary_currency: "",
  salary_period: "",
  apply_url: "",
  external_ref: "",
};

/** Builds one CSV data row from field overrides, keeping column order/count exact. */
function row(overrides: Partial<Record<(typeof COLUMNS)[number], string>> = {}): string {
  const fields = { ...DEFAULTS, ...overrides };
  return COLUMNS.map((c) => fields[c]).join(",");
}

function csvOf(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseJobsCsv", () => {
  it("parses a fully-populated valid row", () => {
    const csv = csvOf(
      row({
        title: "Dragline Operator",
        description: "Experienced dragline operator needed for our Bowen Basin coal operation.",
        country_code: "au",
        region: "Queensland",
        city: "Saraji",
        employment_type: "full time",
        commodity: "coal",
        site_type: "open pit",
        role_category: "Drill & Blast",
        fifo: "yes",
        roster_pattern: "8/6",
        salary_min: "120000",
        salary_max: "150000",
        salary_currency: "aud",
        salary_period: "year",
        apply_url: "https://example.com/apply",
        external_ref: "ext-ref-1",
      })
    );

    const { rows, errors } = parseJobsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    const { data } = rows[0];
    expect(data.title).toBe("Dragline Operator");
    expect(data.country_code).toBe("AU");
    expect(data.employment_type).toBe("FULL_TIME");
    expect(data.commodity).toBe("COAL");
    expect(data.site_type).toBe("OPEN_PIT");
    expect(data.fifo).toBe(true);
    expect(data.salary_min).toBe(120000);
    expect(data.salary_currency).toBe("AUD");
  });

  it("reports the correct 1-indexed-from-header line number for a bad row", () => {
    const csv = csvOf(row({ title: "Good Row" }), row({ title: "Bad Row", description: "too short" }));

    const { rows, errors } = parseJobsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    // header is line 1, first data row is line 2, second data row is line 3.
    expect(errors[0].line).toBe(3);
    expect(errors[0].message).toMatch(/description/i);
  });

  it("normalizes employment_type / commodity / site_type regardless of case or separator style", () => {
    const csv = csvOf(row({ commodity: "Iron Ore", site_type: "open-pit" }));
    const { rows, errors } = parseJobsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].data.commodity).toBe("IRON_ORE");
    expect(rows[0].data.site_type).toBe("OPEN_PIT");
  });

  it("coerces common truthy fifo strings and defaults everything else to false", () => {
    const csv = csvOf(row({ fifo: "Y" }), row({ fifo: "TRUE" }), row({ fifo: "no" }), row({ fifo: "" }));
    const { rows, errors } = parseJobsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.data.fifo)).toEqual([true, true, false, false]);
  });

  it("defaults employment_type to FULL_TIME when the column is blank", () => {
    const { rows } = parseJobsCsv(csvOf(row()));
    expect(rows[0].data.employment_type).toBe("FULL_TIME");
  });

  it("rejects a row with an invalid country_code length", () => {
    const csv = csvOf(row({ country_code: "AUS" }));
    const { rows, errors } = parseJobsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/country_code/i);
  });

  it("rejects an unrecognized enum value instead of silently dropping the row", () => {
    const csv = csvOf(row({ commodity: "unobtainium" }));
    const { rows, errors } = parseJobsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/commodity/i);
  });

  it("treats a blank optional numeric field as absent rather than erroring", () => {
    const { rows, errors } = parseJobsCsv(csvOf(row()));
    expect(errors).toEqual([]);
    expect(rows[0].data.salary_min).toBeUndefined();
  });

  it("handles header column names case-insensitively and trims whitespace", () => {
    const mixedCaseHeader = COLUMNS.map((c) => ` ${c.toUpperCase()} `).join(",");
    const csv = [mixedCaseHeader, row()].join("\n");
    const { rows, errors } = parseJobsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("rejects a description shorter than 30 characters", () => {
    const csv = csvOf(row({ description: "way too short" }));
    const { rows, errors } = parseJobsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/description/i);
  });
});
