"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slot = { id: string; startsAt: string; durationMinutes: number; location: string | null };

function formatSlot(startsAt: string, durationMinutes: number) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const date = start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const time = `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
  return `${date}, ${time}`;
}

/** Candidate-facing list of interview times an employer proposed. Times are
 *  formatted with the browser's own locale/timezone, so what's shown here
 *  always matches the viewer's own clock regardless of where the employer
 *  who proposed it is based. */
export function InterviewSlotPicker({ slots }: { slots: Slot[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function book(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/interview-slots/${id}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't book that time");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusyId(null);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {slots.map((s) => (
        <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{formatSlot(s.startsAt, s.durationMinutes)}</p>
            {s.location && <p className="text-xs text-ink/60">{s.location}</p>}
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 text-sm"
            disabled={busyId !== null}
            onClick={() => book(s.id)}
          >
            {busyId === s.id ? "Booking…" : "Book this time"}
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-oxide">{error}</p>}
    </div>
  );
}
