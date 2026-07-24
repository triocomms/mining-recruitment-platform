"use client";

import { useMemo, useState } from "react";
import { WORLD_PATHS, WORLD_MAP_VIEWBOX } from "./world-map-paths";

/**
 * Interactive world map of live jobs. Countries with live roles glow in
 * brand-primary teal (opacity scales with count); hover shows a tooltip and
 * clicking through lands on the pre-filtered jobs search.
 * Desktop-only by design — the wrapper never loads this chunk on mobile.
 */
export default function WorldJobsMap({ counts }: { counts: Record<string, number> }) {
  const [tip, setTip] = useState<{ x: number; y: number; iso: string } | null>(null);

  const regionNames = useMemo(
    () => new Intl.DisplayNames(["en"], { type: "region" }),
    []
  );
  const maxCount = Math.max(1, ...Object.values(counts));

  function countryName(iso: string) {
    try {
      return regionNames.of(iso) ?? iso;
    } catch {
      return iso;
    }
  }

  return (
    <div
      className="relative"
      onMouseLeave={() => setTip(null)}
    >
      <svg
        viewBox={WORLD_MAP_VIEWBOX}
        className="h-auto w-full"
        role="img"
        aria-label="World map of live jobs by country"
      >
        {Object.entries(WORLD_PATHS).map(([iso, d]) => {
          const count = counts[iso] ?? 0;
          const hasJobs = count > 0;
          const isHovered = tip?.iso === iso;
          const intensity = hasJobs
            ? isHovered
              ? 1
              : 0.45 + 0.5 * Math.min(1, count / maxCount)
            : 1;
          const path = (
            <path
              key={iso}
              d={d}
              fill={hasJobs ? "#0F6E56" : isHovered ? "#C9C7BC" : "#E1DFD6"}
              fillOpacity={intensity}
              stroke={hasJobs ? (isHovered ? "#085041" : "#0F6E56") : "#D3D1C7"}
              strokeWidth={hasJobs ? 0.8 : 0.5}
              className={hasJobs ? "cursor-pointer" : ""}
              style={{ transition: "fill-opacity 150ms, stroke 150ms" }}
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, iso });
              }}
              onMouseLeave={() => setTip(null)}
            />
          );
          return hasJobs ? (
            <a key={iso} href={`/jobs?country=${iso}`} aria-label={`${countryName(iso)}: ${count} live job${count === 1 ? "" : "s"}`}>
              {path}
            </a>
          ) : (
            path
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-bone px-3 py-1.5 text-sm text-ink shadow-lg"
          style={{ left: tip.x, top: tip.y - 44 }}
          role="status"
        >
          <span className="font-semibold">{countryName(tip.iso)}</span>
          {" · "}
          {(counts[tip.iso] ?? 0) > 0 ? (
            <span className="text-hivis-deep font-semibold">
              {counts[tip.iso]} live job{counts[tip.iso] === 1 ? "" : "s"} →
            </span>
          ) : (
            <span className="text-ink/50">no live jobs yet</span>
          )}
        </div>
      )}
    </div>
  );
}
