import { addDaysIso, daysBetweenIso } from '@/lib/isoDay';

/** Active female birds; roosters and inactive birds are never counted as hens. */
export function isActiveHen(hen: { is_active?: boolean | null; hen_type?: string | null }): boolean {
  return hen.is_active === true && hen.hen_type !== 'rooster';
}

/** Productivity uses adult laying hens, while the flock total includes pullets. */
export function isLayingHen(hen: { is_active?: boolean | null; hen_type?: string | null }): boolean {
  return isActiveHen(hen) && (hen.hen_type ?? 'hen') === 'hen';
}

/** Totals over consecutive local calendar days, including today. */
export function summarizeEggPeriod(
  eggs: { date: string; count: number }[],
  today: string,
  periodDays: 7 | 30 | null,
) {
  const start = periodDays && addDaysIso(today, 1 - periodDays);
  const previousStart = periodDays && addDaysIso(today, 1 - 2 * periodDays);
  const dayTotals = new Map<string, number>();
  let firstDay = today;
  let currentTotal = 0;
  let previousTotal = 0;
  for (const egg of eggs) {
    if (!egg.date || egg.date > today) continue;
    if (start && egg.date < start) {
      if (previousStart && egg.date >= previousStart) previousTotal += egg.count;
      continue;
    }
    currentTotal += egg.count;
    dayTotals.set(egg.date, (dayTotals.get(egg.date) ?? 0) + egg.count);
    if (egg.date < firstDay) firstDay = egg.date;
  }
  const days = periodDays ?? (1 + (daysBetweenIso(firstDay, today) ?? 0));
  let bestDay: [string, number] | null = null;
  for (const entry of dayTotals) {
    if (!bestDay || entry[1] > bestDay[1]) bestDay = entry;
  }
  return { currentTotal, previousTotal, bestDay, avgPerDay: currentTotal / days };
}
