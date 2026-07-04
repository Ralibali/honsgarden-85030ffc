/**
 * Tracks personal records ("PR") for egg counts.
 * Stored locally per user — fast and good enough for delight UX
 * (the source of truth is still the egg_logs table).
 */
import { localCalendarDate } from '@/lib/datetime';


export type RecordType = 'day' | 'week';

interface RecordCheckResult {
  isNew: boolean;
  type: RecordType;
  value: number;
  previous: number;
}

function key(userId: string | undefined | null, type: RecordType) {
  return `honsgarden-pr-${type}-${userId || 'anon'}`;
}

function read(userId: string | undefined | null, type: RecordType): number {
  if (typeof window === 'undefined') return 0;
  const v = parseInt(localStorage.getItem(key(userId, type)) || '0', 10);
  return Number.isFinite(v) ? v : 0;
}

function write(userId: string | undefined | null, type: RecordType, value: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key(userId, type), String(value));
}

/**
 * Sum eggs grouped by date for a given list. Returns Map<dateStr, count>.
 */
function sumByDate(eggs: Array<{ date: string; count?: number }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of eggs) {
    if (!e.date) continue;
    m.set(e.date, (m.get(e.date) || 0) + (e.count || 0));
  }
  return m;
}

/** Sum a rolling 7-day window ending on dateStr (inclusive). */
function rollingWeekTotal(byDate: Map<string, number>, dateStr: string): number {
  const end = new Date(dateStr);
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const ds = localCalendarDate(d);
    sum += byDate.get(ds) || 0;
  }
  return sum;
}

/**
 * Given an updated egg list and the date of the new log, return any new PRs.
 * Returns an array because both day and week records may break in the same log.
 */
export function checkPersonalRecords(
  userId: string | undefined | null,
  eggs: Array<{ date: string; count?: number }>,
  affectedDate: string
): RecordCheckResult[] {
  const results: RecordCheckResult[] = [];
  if (!eggs || eggs.length < 2) return results; // first log isn't a "record"

  const byDate = sumByDate(eggs);
  const dayTotal = byDate.get(affectedDate) || 0;
  const weekTotal = rollingWeekTotal(byDate, affectedDate);

  // Compute previous best EXCLUDING the affected date / week so the new log is the one that broke it.
  let prevDayBest = 0;
  for (const [d, c] of byDate.entries()) {
    if (d === affectedDate) continue;
    if (c > prevDayBest) prevDayBest = c;
  }

  let prevWeekBest = 0;
  for (const d of byDate.keys()) {
    if (d === affectedDate) continue;
    const wt = rollingWeekTotal(byDate, d);
    if (wt > prevWeekBest) prevWeekBest = wt;
  }

  const storedDay = read(userId, 'day');
  const storedWeek = read(userId, 'week');
  const dayThreshold = Math.max(prevDayBest, storedDay);
  const weekThreshold = Math.max(prevWeekBest, storedWeek);

  if (dayTotal > dayThreshold && dayTotal >= 2) {
    write(userId, 'day', dayTotal);
    results.push({ isNew: true, type: 'day', value: dayTotal, previous: dayThreshold });
  } else if (dayTotal > storedDay) {
    write(userId, 'day', dayTotal);
  }

  if (weekTotal > weekThreshold && weekTotal >= 5) {
    write(userId, 'week', weekTotal);
    results.push({ isNew: true, type: 'week', value: weekTotal, previous: weekThreshold });
  } else if (weekTotal > storedWeek) {
    write(userId, 'week', weekTotal);
  }

  return results;
}

export function recordLabel(type: RecordType): string {
  return type === 'day' ? 'Bästa dag någonsin!' : 'Bästa vecka någonsin!';
}
