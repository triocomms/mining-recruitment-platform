import {
  ABS_AVERAGE_WEEKLY_EARNINGS,
  ABS_EARNINGS_SOURCE,
  BENCHMARKS_LAST_CHECKED,
  MINING_AWARD_LEVELS,
  MINING_AWARD_SOURCE,
  weeklyToAnnual,
} from "@/lib/salary-benchmarks";

function fmtAud(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    ...opts,
  }).format(n);
}

/**
 * Clearly-labelled public-data section for the salary guide. Deliberately
 * styled and worded to be distinct from the live-job-ad cards elsewhere on
 * the page: dashed border, an explicit "external data" tag, and its own
 * source citations. See src/lib/salary-benchmarks.ts for where the figures
 * come from and how to refresh them.
 */
export function IndustryBenchmarks() {
  const { miningPersons, allIndustriesPersons } = ABS_AVERAGE_WEEKLY_EARNINGS;

  return (
    <section className="mt-8 rounded-card border border-dashed border-ink/25 bg-bone-soft p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag">External data — not FiFoDiDo job ads</span>
      </div>
      <h2 className="mt-3 font-display text-2xl uppercase tracking-wide">Industry benchmarks</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Two public reference points for context while live job-ad data builds up: Australia&apos;s
        mining award minimums, and national average earnings by industry. Neither comes from
        FiFoDiDo listings — treat them as a floor and a broad average, not a substitute for the
        live ranges above once they appear.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-ink/10 bg-white p-4">
          <p className="font-semibold">Mining Industry Award minimums</p>
          <p className="mt-1 text-xs text-ink/50">Full-time, by classification level — AUD, before allowances or loadings</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="pb-1 font-medium">Level</th>
                <th className="pb-1 font-medium">Weekly</th>
                <th className="pb-1 font-medium">Hourly</th>
              </tr>
            </thead>
            <tbody>
              {MINING_AWARD_LEVELS.map((l) => (
                <tr key={l.level} className="border-t border-ink/5">
                  <td className="py-1.5 pr-2">
                    {l.level} <span className="text-ink/50">— {l.classification}</span>
                  </td>
                  <td className="py-1.5 pr-2">{fmtAud(l.weekly)}</td>
                  <td className="py-1.5">{fmtAud(l.hourly, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink/40">
            Award minimums only — most mining employers pay well above these rates, especially for
            FIFO/DIDO rosters and enterprise-agreement sites.
          </p>
        </div>

        <div className="rounded-card border border-ink/10 bg-white p-4">
          <p className="font-semibold">Average earnings, Mining vs. all industries</p>
          <p className="mt-1 text-xs text-ink/50">
            Full-time adult ordinary time earnings, {ABS_EARNINGS_SOURCE.referencePeriod}
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/40">Mining</p>
              <p className="text-lg text-patina">
                {fmtAud(miningPersons)}/wk
                <span className="ml-2 text-xs font-normal text-ink/50">
                  ≈ {fmtAud(weeklyToAnnual(miningPersons))}/yr
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/40">All industries</p>
              <p className="text-lg text-ink/70">
                {fmtAud(allIndustriesPersons)}/wk
                <span className="ml-2 text-xs font-normal text-ink/50">
                  ≈ {fmtAud(weeklyToAnnual(allIndustriesPersons))}/yr
                </span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink/40">
            National averages across all mining roles and seniority levels — a broad benchmark,
            not a typical range for any one job.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink/40">
        Sources:{" "}
        <a href={MINING_AWARD_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">
          {MINING_AWARD_SOURCE.name}
        </a>{" "}
        (as of {MINING_AWARD_SOURCE.asOf}), and{" "}
        <a href={ABS_EARNINGS_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">
          {ABS_EARNINGS_SOURCE.name}
        </a>{" "}
        ({ABS_EARNINGS_SOURCE.referencePeriod}, released {ABS_EARNINGS_SOURCE.released}). Checked{" "}
        {BENCHMARKS_LAST_CHECKED}.
      </p>
    </section>
  );
}
