/**
 * Månadens bokslut: en kort summering av förra månaden som visas på Idag
 * under de första dagarna i en ny månad – värpningen i siffror, bästa
 * dagen och månadens flitigaste höna. Ren och testbar; bygger bara på
 * användarens egna registreringar.
 */
import { addDaysIso, isIsoDay } from '@/lib/isoDay';

export interface RecapEgg {
  date?: string | null;
  count?: number | null;
  hen_id?: string | null;
}

export interface RecapHen {
  id: string;
  name?: string | null;
}

export interface MonthRecap {
  /** yyyy-mm för månaden som summeras. */
  monthKey: string;
  /** "oktober" */
  monthLabel: string;
  /** "september" */
  previousMonthLabel: string;
  totalEggs: number;
  loggedDays: number;
  bestDay: { date: string; count: number } | null;
  /** Förändring i ägg per loggad dag mot månaden innan, eller null när underlaget saknas. */
  changePct: number | null;
  topHen: { name: string; eggs: number } | null;
}

/** Dagar in i en ny månad som bokslutet visas. */
export const RECAP_VISIBLE_DAYS = 7;
/** Minsta antal loggade dagar för att en månad ska summeras. */
export const RECAP_MIN_LOGGED_DAYS = 5;

function monthLabelFor(monthKey: string): string {
  return new Date(`${monthKey}-15T12:00:00Z`).toLocaleDateString('sv-SE', { month: 'long', timeZone: 'UTC' });
}

function previousMonthKey(todayIso: string): string | null {
  const firstOfMonth = `${todayIso.slice(0, 7)}-01`;
  const lastOfPrevious = addDaysIso(firstOfMonth, -1);
  return lastOfPrevious ? lastOfPrevious.slice(0, 7) : null;
}

interface MonthStats {
  total: number;
  loggedDays: number;
  byDay: Map<string, number>;
  byHen: Map<string, number>;
}

function statsFor(eggs: RecapEgg[], monthKey: string): MonthStats {
  const byDay = new Map<string, number>();
  const byHen = new Map<string, number>();
  for (const row of eggs) {
    if (!isIsoDay(row?.date) || !row.date.startsWith(monthKey)) continue;
    const count = Number(row.count ?? 0);
    if (!Number.isFinite(count) || count < 0) continue;
    byDay.set(row.date, (byDay.get(row.date) || 0) + count);
    if (row.hen_id && count > 0) byHen.set(row.hen_id, (byHen.get(row.hen_id) || 0) + count);
  }
  let total = 0;
  for (const value of byDay.values()) total += value;
  return { total, loggedDays: byDay.size, byDay, byHen };
}

/**
 * Summerar månaden före `todayIso`. Returnerar null när det inte finns
 * tillräckligt med registreringar för att säga något meningsfullt.
 */
export function computeMonthRecap(eggs: RecapEgg[], hens: RecapHen[], todayIso: string): MonthRecap | null {
  if (!isIsoDay(todayIso)) return null;
  const monthKey = previousMonthKey(todayIso);
  if (!monthKey) return null;
  const month = statsFor(eggs, monthKey);
  if (month.loggedDays < RECAP_MIN_LOGGED_DAYS) return null;

  const beforeKey = previousMonthKey(`${monthKey}-01`);
  const before = beforeKey ? statsFor(eggs, beforeKey) : null;
  let changePct: number | null = null;
  if (before && before.loggedDays >= RECAP_MIN_LOGGED_DAYS && before.total > 0) {
    const perDayNow = month.total / month.loggedDays;
    const perDayBefore = before.total / before.loggedDays;
    changePct = Math.round(((perDayNow - perDayBefore) / perDayBefore) * 100);
  }

  let bestDay: MonthRecap['bestDay'] = null;
  for (const [date, count] of [...month.byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (count > 0 && (!bestDay || count > bestDay.count)) bestDay = { date, count };
  }

  let topHen: MonthRecap['topHen'] = null;
  if (month.byHen.size >= 2) {
    const [henId, henEggs] = [...month.byHen.entries()].sort((a, b) => b[1] - a[1])[0];
    const name = hens.find((h) => h.id === henId)?.name?.trim();
    if (name) topHen = { name, eggs: henEggs };
  }

  return {
    monthKey,
    monthLabel: monthLabelFor(monthKey),
    previousMonthLabel: beforeKey ? monthLabelFor(beforeKey) : '',
    totalEggs: month.total,
    loggedDays: month.loggedDays,
    bestDay,
    changePct,
    topHen,
  };
}

/** Bokslutet visas bara de första dagarna i en ny månad. */
export function isRecapWindow(todayIso: string): boolean {
  if (!isIsoDay(todayIso)) return false;
  return Number(todayIso.slice(8, 10)) <= RECAP_VISIBLE_DAYS;
}
