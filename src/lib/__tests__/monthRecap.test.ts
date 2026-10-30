import { describe, expect, it } from 'vitest';
import { computeMonthRecap, isRecapWindow, type RecapEgg } from '@/lib/monthRecap';

function month(prefix: string, days: number, perDay: number, henIds: string[] = []): RecapEgg[] {
  const rows: RecapEgg[] = [];
  for (let d = 1; d <= days; d += 1) {
    const date = `${prefix}-${String(d).padStart(2, '0')}`;
    if (henIds.length === 0) rows.push({ date, count: perDay });
    else henIds.forEach((hen_id, i) => rows.push({ date, count: i === 0 ? perDay : 1, hen_id }));
  }
  return rows;
}

const hens = [{ id: 'gun', name: 'Gun-Britt' }, { id: 'agda', name: 'Agda' }];

describe('computeMonthRecap', () => {
  it('summerar förra månaden med jämförelse per loggad dag', () => {
    const eggs = [...month('2026-09', 30, 2), ...month('2026-10', 31, 3)];
    const recap = computeMonthRecap(eggs, hens, '2026-11-03')!;
    expect(recap).toMatchObject({
      monthKey: '2026-10',
      monthLabel: 'oktober',
      previousMonthLabel: 'september',
      totalEggs: 93,
      loggedDays: 31,
      changePct: 50,
    });
  });

  it('hittar bästa dagen och månadens flitigaste höna', () => {
    const eggs = [...month('2026-10', 20, 2, ['gun', 'agda']), { date: '2026-10-21', count: 7, hen_id: 'agda' }];
    const recap = computeMonthRecap(eggs, hens, '2026-11-01')!;
    expect(recap.bestDay).toEqual({ date: '2026-10-21', count: 7 });
    expect(recap.topHen).toEqual({ name: 'Gun-Britt', eggs: 40 });
  });

  it('räknar äggfria dagar som loggade men aldrig som bästa dag', () => {
    const eggs = month('2026-12', 10, 0);
    const recap = computeMonthRecap(eggs, hens, '2027-01-02')!;
    expect(recap).toMatchObject({ monthKey: '2026-12', totalEggs: 0, loggedDays: 10, bestDay: null, changePct: null });
  });

  it('kräver minst fem loggade dagar', () => {
    expect(computeMonthRecap(month('2026-10', 4, 3), hens, '2026-11-02')).toBeNull();
  });

  it('kräver minst två hönor för en topphöna', () => {
    const eggs = month('2026-10', 10, 2, ['gun']);
    expect(computeMonthRecap(eggs, hens, '2026-11-02')!.topHen).toBeNull();
  });
});

describe('isRecapWindow', () => {
  it('visar bokslutet de första sju dagarna i månaden', () => {
    expect(isRecapWindow('2026-11-01')).toBe(true);
    expect(isRecapWindow('2026-11-07')).toBe(true);
    expect(isRecapWindow('2026-11-08')).toBe(false);
  });
});
