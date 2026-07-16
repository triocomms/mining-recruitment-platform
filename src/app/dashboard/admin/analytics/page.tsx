import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backfillDays, utcDayStart } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function Bars({ values, color = "#b45309" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const w = 6;
  const gap = 2;
  const h = 48;
  return (
    <svg
      width={values.length * (w + gap)}
      height={h}
      role="img"
      aria-label={`Last ${values.length} days, max ${max}`}
      className="mt-2"
    >
      {values.map((v, i) => {
        const bh = Math.max(1, Math.round((v / max) * (h - 2)));
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bh}
            width={w}
            height={bh}
            rx={1}
            fill={color}
            opacity={0.35 + 0.65 * (v / max)}
          />
        );
      })}
    </svg>
  );
}

function Metric(props: { label: string; total: string; values: number[]; color?: string }) {
  return (
    <div className="card">
      <p className="label">{props.label}</p>
      <p className="font-display text-2xl">{props.total}</p>
      <Bars values={props.values} color={props.color} />
      <p className="mt-1 text-[10px] text-ink/40">last 30 days →</p>
    </div>
  );
}

const money = (cents: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  // Idempotent: fills any missing days and refreshes today.
  await backfillDays(30);

  const from = new Date(utcDayStart(new Date()).getTime() - 29 * 24 * 3600 * 1000);
  const stats = await prisma.dailyStat.findMany({
    where: { date: { gte: from } },
    orderBy: { date: "asc" },
  });

  const series = (f: (s: (typeof stats)[number]) => number) => stats.map(f);
  const sum = (f: (s: (typeof stats)[number]) => number) => stats.reduce((a, s) => a + f(s), 0);
  const today = stats[stats.length - 1];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Analytics</h1>
        <Link href="/dashboard/admin" className="text-sm underline">← Admin dashboard</Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Daily rollups, refreshed by the nightly cron (and on page load for today).
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Candidate signups (30d)"
          total={String(sum((s) => s.candidateSignups))}
          values={series((s) => s.candidateSignups)}
        />
        <Metric
          label="Employer signups (30d)"
          total={String(sum((s) => s.employerSignups))}
          values={series((s) => s.employerSignups)}
          color="#0f766e"
        />
        <Metric
          label="Jobs posted (30d)"
          total={String(sum((s) => s.jobsPosted))}
          values={series((s) => s.jobsPosted)}
        />
        <Metric
          label="Applications (30d)"
          total={String(sum((s) => s.applications))}
          values={series((s) => s.applications)}
          color="#0f766e"
        />
        <Metric
          label="MRR"
          total={today ? money(today.mrrCents) : "$0"}
          values={series((s) => s.mrrCents)}
        />
        <Metric
          label="Churned subs (30d)"
          total={String(sum((s) => s.churnedSubs))}
          values={series((s) => s.churnedSubs)}
          color="#b91c1c"
        />
        <Metric
          label="Overage revenue (30d)"
          total={money(sum((s) => s.overageRevenueCents))}
          values={series((s) => s.overageRevenueCents)}
        />
        <Metric
          label="Active subscriptions"
          total={String(today?.activeSubs ?? 0)}
          values={series((s) => s.activeSubs)}
          color="#0f766e"
        />
      </section>

      {today && (
        <section className="mt-8">
          <h2 className="font-display text-xl uppercase tracking-wide">MRR by tier (today)</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["Bronze", today.mrrCentsBronze],
              ["Silver", today.mrrCentsSilver],
              ["Gold", today.mrrCentsGold],
            ].map(([label, cents]) => (
              <div key={label as string} className="card text-center">
                <p className="font-display text-2xl">{money(cents as number)}</p>
                <p className="label">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
