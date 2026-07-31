import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getStatsRange,
  getPreviousStatsRange,
  resolveRange,
  isoDate,
  type RangePreset,
} from "@/lib/analytics";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const money = (cents: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

const shortDate = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });

/** Period-over-period delta as a rounded percentage. Returns null when
 * there's nothing meaningful to compare against (avoids a divide-by-zero
 * "Infinity%" the moment a metric goes from 0 to something). */
function pctChange(curr: number, prev: number): { text: string; positive: boolean | null } {
  if (prev === 0) {
    if (curr === 0) return { text: "—", positive: null };
    return { text: "new", positive: true };
  }
  const change = ((curr - prev) / prev) * 100;
  const rounded = Math.round(change);
  return { text: `${rounded > 0 ? "+" : ""}${rounded}%`, positive: change >= 0 };
}

/** `invert` flips good/bad colouring for metrics where "up" is bad news
 * (e.g. churned subscriptions) rather than good news. */
function Delta({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const { text, positive } = pctChange(curr, prev);
  if (positive === null) return <span className="text-[11px] text-ink/40">{text}</span>;
  const good = invert ? !positive : positive;
  return (
    <span className={`text-[11px] font-semibold ${good ? "text-patina" : "text-oxide"}`}>
      {positive ? "▲" : "▼"} {text}
    </span>
  );
}

function Metric(props: {
  label: string;
  total: string;
  curr: number;
  prev: number;
  points: { date: string; value: number }[];
  color?: string;
  format?: "number" | "currency";
  invert?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <p className="label">{props.label}</p>
        <Delta curr={props.curr} prev={props.prev} invert={props.invert} />
      </div>
      <p className="font-display text-2xl">{props.total}</p>
      <AnalyticsChart points={props.points} color={props.color} format={props.format} />
    </div>
  );
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "qtd", label: "This quarter" },
  { key: "ytd", label: "This year" },
];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const { from, to, preset } = resolveRange(searchParams);
  // Sequential, not Promise.all -- each of these can itself fan out into a
  // batch of rollupDay calls on a first-ever load of a wide range, so
  // running both at once would double the peak concurrent DB load right
  // when it's already highest.
  const stats = await getStatsRange(from, to);
  const prevStats = await getPreviousStatsRange(from, to);

  const series = (f: (s: (typeof stats)[number]) => number) =>
    stats.map((s) => ({ date: shortDate(s.date), value: f(s) }));
  const sum = (rows: typeof stats, f: (s: (typeof stats)[number]) => number) =>
    rows.reduce((a, s) => a + f(s), 0);
  const latest = stats[stats.length - 1];
  const prevLatest = prevStats[prevStats.length - 1];

  const rangeLabel = `${shortDate(from)} – ${shortDate(to)}`;
  const requestedDays = Math.round((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1;
  const wasClamped = stats.length > 0 && stats.length < requestedDays;

  const exportQs = new URLSearchParams({
    preset: "custom",
    from: isoDate(from),
    to: isoDate(to),
  }).toString();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3 print:hidden">
        <h1 className="font-display text-3xl uppercase tracking-wide">Analytics</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>

      {/* Print-only header -- the on-screen title/nav above is hidden when printing (see print:hidden). */}
      <div className="hidden print:block">
        <h1 className="font-display text-2xl uppercase tracking-wide">FiFoDiDo — Analytics report</h1>
        <p className="text-sm">{rangeLabel} · generated {new Date().toLocaleString("en-AU")}</p>
      </div>

      <p className="mt-1 text-sm text-ink/60 print:hidden">
        Daily rollups, refreshed by the nightly cron (and on page load for the most recent day).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`?preset=${p.key}`}
            className={`tag ${preset === p.key ? "bg-oregold/20 text-oregold" : ""}`}
          >
            {p.label}
          </Link>
        ))}
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="preset" value="custom" />
          <label className="flex flex-col text-xs text-ink/60">
            From
            <input
              type="date"
              name="from"
              defaultValue={isoDate(from)}
              className="rounded border border-ink-line px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-xs text-ink/60">
            To
            <input
              type="date"
              name="to"
              defaultValue={isoDate(to)}
              max={isoDate(new Date())}
              className="rounded border border-ink-line px-2 py-1"
            />
          </label>
          <button type="submit" className="btn-ghost">Apply</button>
        </form>
        <div className="ml-auto flex gap-2">
          <a href={`/api/admin/analytics/export?${exportQs}`} className="btn-ghost">Export CSV</a>
          <PrintButton />
        </div>
      </div>

      <p className="mt-2 text-sm font-semibold print:hidden">{rangeLabel}</p>
      {wasClamped && (
        <p className="mt-1 text-xs text-ink/50 print:hidden">
          This range is capped at {stats.length} days of data per load to keep the dashboard fast --
          showing the most recent {stats.length} days up to {shortDate(to)}.
        </p>
      )}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Candidate signups"
          total={String(sum(stats, (s) => s.candidateSignups))}
          curr={sum(stats, (s) => s.candidateSignups)}
          prev={sum(prevStats, (s) => s.candidateSignups)}
          points={series((s) => s.candidateSignups)}
        />
        <Metric
          label="Employer signups"
          total={String(sum(stats, (s) => s.employerSignups))}
          curr={sum(stats, (s) => s.employerSignups)}
          prev={sum(prevStats, (s) => s.employerSignups)}
          points={series((s) => s.employerSignups)}
          color="#0F6E56"
        />
        <Metric
          label="Jobs posted"
          total={String(sum(stats, (s) => s.jobsPosted))}
          curr={sum(stats, (s) => s.jobsPosted)}
          prev={sum(prevStats, (s) => s.jobsPosted)}
          points={series((s) => s.jobsPosted)}
        />
        <Metric
          label="Applications"
          total={String(sum(stats, (s) => s.applications))}
          curr={sum(stats, (s) => s.applications)}
          prev={sum(prevStats, (s) => s.applications)}
          points={series((s) => s.applications)}
          color="#0F6E56"
        />
        <Metric
          label="MRR"
          total={latest ? money(latest.mrrCents) : "$0"}
          curr={latest?.mrrCents ?? 0}
          prev={prevLatest?.mrrCents ?? 0}
          points={series((s) => s.mrrCents)}
          format="currency"
        />
        <Metric
          label="Churned subs"
          total={String(sum(stats, (s) => s.churnedSubs))}
          curr={sum(stats, (s) => s.churnedSubs)}
          prev={sum(prevStats, (s) => s.churnedSubs)}
          points={series((s) => s.churnedSubs)}
          color="#D85A30"
          invert
        />
        <Metric
          label="Overage revenue"
          total={money(sum(stats, (s) => s.overageRevenueCents))}
          curr={sum(stats, (s) => s.overageRevenueCents)}
          prev={sum(prevStats, (s) => s.overageRevenueCents)}
          points={series((s) => s.overageRevenueCents)}
          format="currency"
        />
        <Metric
          label="Active subscriptions"
          total={String(latest?.activeSubs ?? 0)}
          curr={latest?.activeSubs ?? 0}
          prev={prevLatest?.activeSubs ?? 0}
          points={series((s) => s.activeSubs)}
          color="#0F6E56"
        />
      </section>

      {latest && (
        <section className="mt-8 print:mt-6">
          <h2 className="font-display text-xl uppercase tracking-wide">MRR by tier ({shortDate(to)})</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["Bronze", latest.mrrCentsBronze],
              ["Silver", latest.mrrCentsSilver],
              ["Gold", latest.mrrCentsGold],
            ].map(([label, cents]) => (
              <div key={label as string} className="card text-center">
                <p className="font-display text-2xl">{money(cents as number)}</p>
                <p className="label">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 print:mt-6">
        <h2 className="font-display text-xl uppercase tracking-wide">Daily breakdown</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-ink-line text-ink/50">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Candidates</th>
                <th className="py-1 pr-3">Employers</th>
                <th className="py-1 pr-3">Jobs</th>
                <th className="py-1 pr-3">Applications</th>
                <th className="py-1 pr-3">Churned</th>
                <th className="py-1 pr-3">Overage</th>
                <th className="py-1 pr-3">Active subs</th>
                <th className="py-1">MRR</th>
              </tr>
            </thead>
            <tbody>
              {[...stats].reverse().map((s) => (
                <tr key={s.date.toISOString()} className="border-b border-ink-line/50">
                  <td className="py-1 pr-3">{shortDate(s.date)}</td>
                  <td className="py-1 pr-3">{s.candidateSignups}</td>
                  <td className="py-1 pr-3">{s.employerSignups}</td>
                  <td className="py-1 pr-3">{s.jobsPosted}</td>
                  <td className="py-1 pr-3">{s.applications}</td>
                  <td className="py-1 pr-3">{s.churnedSubs}</td>
                  <td className="py-1 pr-3">{money(s.overageRevenueCents)}</td>
                  <td className="py-1 pr-3">{s.activeSubs}</td>
                  <td className="py-1">{money(s.mrrCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
