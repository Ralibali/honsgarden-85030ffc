/**
 * Små, rena hjälpfunktioner för kalenderdagar på formen yyyy-mm-dd.
 *
 * All dygnsaritmetik sker på UTC-mitt-på-dagen (samma konvention som
 * kläckningskalkylatorn) så att sommartidsskiften aldrig flyttar en dag.
 */
import { parseIsoDate, toIsoDate } from '@/lib/tools/hatchCalculator';

const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDay(value: unknown): value is string {
  return typeof value === 'string' && parseIsoDate(value) !== null;
}

/** Hela dygn från `from` till `to` (negativt om `to` ligger före). null vid ogiltigt datum. */
export function daysBetweenIso(from: string, to: string): number | null {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function addDaysIso(iso: string, days: number): string | null {
  const base = parseIsoDate(iso);
  if (!base || !Number.isFinite(days)) return null;
  return toIsoDate(new Date(base.getTime() + Math.round(days) * DAY_MS));
}

/** Antal dagar i månaden som `iso` ligger i. */
export function daysInMonthIso(iso: string): number | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
}

/** Måndag i samma ISO-vecka som `iso`. */
export function mondayOfWeekIso(iso: string): string | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  const offset = (date.getUTCDay() + 6) % 7; // 0 = måndag
  return toIsoDate(new Date(date.getTime() - offset * DAY_MS));
}
