import { parse } from "csv-parse/sync";
import { z } from "zod";
import {
  Commodity,
  EmploymentType,
  SalaryPeriod,
  SiteExperience,
} from "@prisma/client";

/**
 * CSV bulk job import.
 * Header row required. See docs/job-import-template.csv for the template.
 * Rows are validated individually — good rows import, bad rows are reported
 * back with line numbers so nothing fails silently.
 */
const enumFrom = <T extends Record<string, string>>(e: T) =>
  z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/[\s-]+/g, "_"))
    .pipe(z.nativeEnum(e));

const optionalInt = z
  .string()
  .trim()
  .transform((s) => (s === "" ? undefined : Number(s)))
  .pipe(z.number().int().positive().optional());

export const csvJobRow = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(30),
  country_code: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  region: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  // enumFrom(...).optional() alone only accepts a genuinely-missing key —
  // a CSV blank cell parses as "", not undefined, so without the explicit
  // "" -> fallback branch below every row with a blank optional enum column
  // was being rejected outright instead of treated as "not specified".
  employment_type: enumFrom(EmploymentType)
    .optional()
    .or(z.literal("").transform((): EmploymentType => "FULL_TIME" as EmploymentType)),
  commodity: enumFrom(Commodity).optional().or(z.literal("").transform(() => undefined)),
  site_type: enumFrom(SiteExperience).optional().or(z.literal("").transform(() => undefined)),
  role_category: z.string().trim().max(80).optional().default(""),
  fifo: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((s) => ["yes", "true", "1", "y"].includes(s.toLowerCase())),
  roster_pattern: z.string().trim().max(20).optional().default(""),
  salary_min: optionalInt,
  salary_max: optionalInt,
  salary_currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("").transform(() => undefined)),
  salary_period: enumFrom(SalaryPeriod).optional().or(z.literal("").transform(() => undefined)),
  apply_url: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  external_ref: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
});

export type CsvJobRow = z.infer<typeof csvJobRow>;

export function parseJobsCsv(csvText: string): {
  rows: { line: number; data: CsvJobRow }[];
  errors: { line: number; message: string }[];
} {
  const records: Record<string, string>[] = parse(csvText, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  });

  const rows: { line: number; data: CsvJobRow }[] = [];
  const errors: { line: number; message: string }[] = [];

  records.forEach((record, i) => {
    const line = i + 2; // account for header row
    const result = csvJobRow.safeParse(record);
    if (result.success) {
      rows.push({ line, data: result.data });
    } else {
      const msg = result.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      errors.push({ line, message: msg });
    }
  });

  return { rows, errors };
}
