"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Loaded lazily and only on desktop viewports — phones never download the
// map chunk (~50 KB) and see nothing (the simple search flow stays primary).
const WorldJobsMap = dynamic(() => import("./WorldJobsMap"), { ssr: false });

export function HomeWorldMap({ counts }: { counts: Record<string, number> }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!isDesktop) return null;

  const countries = Object.keys(counts).length;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section className="rounded-card border border-ink/10 bg-white px-8 py-8 text-ink">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">
            Hiring across the planet
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            {total} live {total === 1 ? "role" : "roles"} in {countries}{" "}
            {countries === 1 ? "country" : "countries"} — hover a country, click through to its jobs.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <WorldJobsMap counts={counts} />
      </div>
      <p className="mt-2 text-right text-[10px] text-ink/30">
        Map: Al MacDonald / Fritz Lekschas, CC BY-SA 3.0
      </p>
    </section>
  );
}
