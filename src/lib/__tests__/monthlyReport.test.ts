import { describe, it, expect } from 'vitest';
import { summarizeMonth } from '../monthlyReportPdf';

const base = {
  month: new Date(2026, 6, 15), // juli 2026
  henCount: 5,
};

describe('summarizeMonth', () => {
  it('summerar ägg för rätt månad och ignorerar andra månader', () => {
    const s = summarizeMonth({
      ...base,
      eggs: [
        { date: '2026-07-01', count: 3 },
        { date: '2026-07-01', count: 2 }, // samma dag, två loggar
        { date: '2026-07-02', count: 4 },
        { date: '2026-06-30', count: 10 }, // fel månad
        { date: '2026-08-01', count: 10 }, // fel månad
      ],
      transactions: [],
    });
    expect(s.totalEggs).toBe(9);
    expect(s.perDay[0]).toBe(5);
    expect(s.perDay[1]).toBe(4);
    expect(s.daysWithEggs).toBe(2);
    expect(s.avgPerDay).toBeCloseTo(4.5);
  });

  it('hittar bästa dagen', () => {
    const s = summarizeMonth({
      ...base,
      eggs: [
        { date: '2026-07-03', count: 1 },
        { date: '2026-07-14', count: 7 },
        { date: '2026-07-14', count: 1 },
      ],
      transactions: [],
    });
    expect(s.bestDay).toBe(14);
    expect(s.bestCount).toBe(8);
  });

  it('räknar intäkter, kostnader, netto och kostnad per ägg', () => {
    const s = summarizeMonth({
      ...base,
      eggs: [{ date: '2026-07-10', count: 20 }],
      transactions: [
        { date: '2026-07-05', type: 'income', amount: 300 },
        { date: '2026-07-06', type: 'expense', amount: 200 },
        { date: '2026-07-07', type: 'expense', amount: 100 },
        { date: '2026-06-30', type: 'income', amount: 999 }, // fel månad
      ],
    });
    expect(s.income).toBe(300);
    expect(s.expense).toBe(300);
    expect(s.net).toBe(0);
    expect(s.costPerEgg).toBeCloseTo(15);
  });

  it('hanterar månad helt utan data', () => {
    const s = summarizeMonth({ ...base, eggs: [], transactions: [] });
    expect(s.totalEggs).toBe(0);
    expect(s.bestDay).toBeNull();
    expect(s.avgPerDay).toBe(0);
    expect(s.costPerEgg).toBeNull();
  });

  it('ger rätt antal dagar för februari (skottår)', () => {
    const s = summarizeMonth({
      month: new Date(2024, 1, 10),
      henCount: 1,
      eggs: [{ date: '2024-02-29', count: 2 }],
      transactions: [],
    });
    expect(s.daysInMonth).toBe(29);
    expect(s.perDay[28]).toBe(2);
  });
});
