export type AlertFrequency = "DAILY" | "WEEKLY";

const WEEKLY_INTERVAL_DAYS = 7;

/**
 * The daily cron (src/lib/cron.ts, sendSavedSearchAlerts) runs once a day
 * for every saved search — there's no separate weekly trigger (Vercel
 * Hobby only allows a daily cron). So "weekly" is enforced here instead:
 * skip a WEEKLY search until at least 7 days have passed since it was
 * last checked. The caller must leave lastNotifiedAt untouched on a
 * skipped day so matches keep accumulating for the next weekly send
 * rather than being silently dropped.
 */
export function shouldCheckSavedSearchToday(
  frequency: AlertFrequency,
  lastNotifiedAt: Date | null,
  now: Date = new Date()
): boolean {
  if (frequency === "DAILY") return true;
  if (!lastNotifiedAt) return true; // never checked yet — always check the first time
  const elapsedDays = (now.getTime() - lastNotifiedAt.getTime()) / (24 * 3600 * 1000);
  return elapsedDays >= WEEKLY_INTERVAL_DAYS;
}
