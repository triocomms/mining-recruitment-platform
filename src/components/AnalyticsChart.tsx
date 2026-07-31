"use client";

import { useMemo, useState } from "react";

export type ChartPoint = { date: string; value: number };

const currencyFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Dependency-free SVG line/area chart for the analytics dashboard --
 * gridlines, start/end date labels, and a hover tooltip that snaps to the
 * nearest point. No charting library: this project's CI runs `npm ci`
 * against a committed package-lock.json, so adding a new dependency safely
 * needs a proper npm install pass (regenerating the lockfile), not a hand
 * edit. A custom chart keeps this shippable today with no lockfile risk.
 *
 * `format` is a plain string, not a callback -- this is a Client Component
 * rendered from a Server Component page, and functions can't cross that
 * boundary as props (only serialisable values can), so the value formatter
 * lives here instead of being passed in.
 */
export function AnalyticsChart({
  points,
  color = "#b45309",
  format = "number",
}: {
  points: ChartPoint[];
  color?: string;
  format?: "number" | "currency";
}) {
  const [hover, setHover] = useState<number | null>(null);

  const formatValue = (v: number) => (format === "currency" ? currencyFormatter.format(v / 100) : String(v));

  const W = 600;
  const H = 120;
  const padL = 4;
  const padR = 4;
  const padT = 8;
  const padB = 4;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));

  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const linePath = useMemo(
    () => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" "),
    [points, max]
  );
  const areaPath = n
    ? `${linePath} L${x(n - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`
    : "";
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => padT + (1 - f) * (H - padT - padB));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!n) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - px);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    }
    setHover(closest);
  }

  const hoveredPoint = hover !== null ? points[hover] : null;

  if (!n) {
    return <p className="mt-2 text-[11px] text-ink/40">No data for this range.</p>;
  }

  return (
    <div className="relative mt-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 90 }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Chart from ${points[0].date} to ${points[n - 1].date}, max ${formatValue(max)}`}
      >
        {gridLines.map((gy, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="currentColor" strokeOpacity={0.08} />
        ))}
        <path d={areaPath} fill={color} opacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} />
        {hoveredPoint && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={H - padB} stroke={color} strokeOpacity={0.35} />
            <circle cx={x(hover!)} cy={y(hoveredPoint.value)} r={3} fill={color} />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink/40 print:hidden">
        <span>{points[0].date}</span>
        <span>{points[n - 1].date}</span>
      </div>
      {hoveredPoint && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] text-bone shadow print:hidden"
          style={{ left: `${(x(hover!) / W) * 100}%` }}
        >
          {hoveredPoint.date}: <strong>{formatValue(hoveredPoint.value)}</strong>
        </div>
      )}
    </div>
  );
}
