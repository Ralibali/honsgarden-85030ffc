import { describe, expect, it } from 'vitest';
import { computeLogStreak, computeWeekProgress, loggedDaySet } from '@/lib/logStreak';

describe('loggedDaySet', () => {
  it('räknar äggfria registreringar men inte trasiga eller framtida rader', () => {
    const days = loggedDaySet([
      { date: '2026-11-02', count: 0 },
      { date: '2026-11-03', count: 4 },
      { date: '2026-11-04', count: -1 },
      { date: null, count: 2 },
      { date: '2026-11-30', count: 1 },
    ], '2026-11-05');
    expect([...days].sort()).toEqual(['2026-11-02', '2026-11-03']);
  });
});

describe('computeLogStreak', () => {
  it('håller streaken vid liv genom vinterns äggfria dagar', () => {
    const rows = [
      { date: '2026-11-01', count: 2 },
      { date: '2026-11-02', count: 0 },
      { date: '2026-11-03', count: 0 },
      { date: '2026-11-04', count: 1 },
    ];
    expect(computeLogStreak(rows, '2026-11-04')).toEqual({ current: 4, loggedToday: true, eggsToday: 1 });
  });

  it('låter dagen vara öppen till midnatt innan streaken bryts', () => {
    const rows = [{ date: '2026-11-02', count: 3 }, { date: '2026-11-03', count: 2 }];
    expect(computeLogStreak(rows, '2026-11-04')).toMatchObject({ current: 2, loggedToday: false });
    expect(computeLogStreak(rows, '2026-11-05').current).toBe(0);
  });

  it('räknar en äggfri dag som loggad men med noll ägg', () => {
    expect(computeLogStreak([{ date: '2026-11-04', count: 0 }], '2026-11-04')).toEqual({ current: 1, loggedToday: true, eggsToday: 0 });
  });

  it('klarar sommartidsskiftet', () => {
    const rows = ['2026-10-24', '2026-10-25', '2026-10-26'].map((date) => ({ date, count: 1 }));
    expect(computeLogStreak(rows, '2026-10-26').current).toBe(3);
  });
});

describe('computeWeekProgress', () => {
  const week = (dates: string[], count = 1) => dates.map((date) => ({ date, count }));

  it('fyller måndag–söndag och räknar vad som återstår', () => {
    // Torsdag 5 nov 2026; måndag–onsdag loggade, idag inte än.
    const w = computeWeekProgress(week(['2026-11-02', '2026-11-03', '2026-11-04']), '2026-11-05')!;
    expect(w.weekStart).toBe('2026-11-02');
    expect(w.days.map((d) => d.label)).toEqual(['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön']);
    expect(w.loggedCount).toBe(3);
    expect(w.remainingPossible).toBe(4);
    expect(w.days[3]).toMatchObject({ isToday: true, logged: false });
    expect(w.days[6].isFuture).toBe(true);
    expect(w.perfect).toBe(false);
  });

  it('känner igen en perfekt vecka och räknar perfekta veckor i rad', () => {
    const lastWeek = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    const thisWeek = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    const w = computeWeekProgress([...week(lastWeek), ...week(thisWeek, 0)], '2026-11-08')!;
    expect(w.perfect).toBe(true);
    expect(w.perfectWeeksInRow).toBe(2);
  });

  it('räknar tidigare perfekta veckor även när den här inte är klar än', () => {
    const lastWeek = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    const w = computeWeekProgress(week([...lastWeek, '2026-11-02']), '2026-11-03')!;
    expect(w.perfect).toBe(false);
    expect(w.perfectWeeksInRow).toBe(1);
  });

  it('returnerar null för ogiltigt datum', () => {
    expect(computeWeekProgress([], 'inte-ett-datum')).toBeNull();
  });
});
