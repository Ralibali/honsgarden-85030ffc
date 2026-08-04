import { describe, it, expect } from 'vitest';
import { compareWeeks } from '../weekComparison';

const now = new Date(2026, 6, 17); // fredag 17 juli
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => iso(new Date(2026, 6, 17 - n));

describe('compareWeeks', () => {
  it('räknar denna vecka och förra veckan separat', () => {
    const eggs = [
      { date: daysAgo(0), count: 5 },  // idag
      { date: daysAgo(6), count: 10 }, // fortfarande denna vecka
      { date: daysAgo(7), count: 8 },  // förra veckan börjar
      { date: daysAgo(13), count: 4 },
      { date: daysAgo(14), count: 99 }, // utanför – ska ignoreras
    ];
    const r = compareWeeks(eggs, now);
    expect(r.thisWeek).toBe(15);
    expect(r.lastWeek).toBe(12);
    expect(r.deltaPct).toBeCloseTo(25);
  });

  it('ger negativ delta vid nedgång', () => {
    const eggs = [
      { date: daysAgo(1), count: 2 },
      { date: daysAgo(8), count: 10 },
    ];
    const r = compareWeeks(eggs, now);
    expect(r.deltaPct).toBeCloseTo(-80);
  });

  it('ger null när förra veckan saknar data', () => {
    const r = compareWeeks([{ date: daysAgo(2), count: 5 }], now);
    expect(r.thisWeek).toBe(5);
    expect(r.lastWeek).toBe(0);
    expect(r.deltaPct).toBeNull();
  });

  it('tål tom data och skräprader', () => {
    const r = compareWeeks([{ date: '', count: 3 }, { date: 'inte-ett-datum', count: 2 }], now);
    expect(r.thisWeek).toBe(0);
    expect(r.deltaPct).toBeNull();
  });
});
