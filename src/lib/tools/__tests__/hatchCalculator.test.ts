import { describe, it, expect } from 'vitest';
import {
  CHICKEN_INCUBATION_DAYS,
  computeHatchPlan,
  daysUntilHatch,
  formatSvDate,
  parseIsoDate,
  toIsoDate,
} from '../hatchCalculator';

describe('parseIsoDate', () => {
  it('parsar giltiga datum', () => {
    expect(parseIsoDate('2026-03-01')).not.toBeNull();
    expect(toIsoDate(parseIsoDate('2026-03-01')!)).toBe('2026-03-01');
  });

  it('avvisar ogiltiga datum', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('1 mars 2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });

  it('tål årtalsskiften och skottår', () => {
    expect(parseIsoDate('2024-02-29')).not.toBeNull(); // skottår
    expect(parseIsoDate('2025-02-29')).toBeNull();
  });
});

describe('computeHatchPlan', () => {
  it('ger kläckdag på dag 21 räknat från startdagen som dag 0', () => {
    const plan = computeHatchPlan('2026-03-01')!;
    expect(plan.hatchDate).toBe('2026-03-22');
    expect(plan.incubationDays).toBe(CHICKEN_INCUBATION_DAYS);
  });

  it('hanterar månads- och årsskiften', () => {
    expect(computeHatchPlan('2026-12-25')!.hatchDate).toBe('2027-01-15');
    expect(computeHatchPlan('2024-02-20')!.hatchDate).toBe('2024-03-12'); // skottår
  });

  it('ger rätt milstolpar för hönsägg (21 dagar)', () => {
    const plan = computeHatchPlan('2026-03-01')!;
    const byDay = new Map(plan.milestones.map((m) => [m.day, m]));
    expect(byDay.get(0)!.label).toContain('startar');
    expect(byDay.get(7)!.label).toContain('Första lysningen');
    expect(byDay.get(14)!.label).toContain('Andra lysningen');
    expect(byDay.get(18)!.label).toContain('Förbered');
    expect(byDay.get(21)!.label).toContain('kläckdag');
    expect(byDay.get(23)!.label).toContain('Följ upp');
    // Milstolparna ligger i dagsordning med stigande datum.
    const days = plan.milestones.map((m) => m.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it('beräknar andra ruvtider utan att skala biologiska skötselråd', () => {
    const plan = computeHatchPlan('2026-03-01', 18)!; // t.ex. vaktel
    expect(plan.hatchDate).toBe('2026-03-19');
    expect(plan.milestones.map(m => m.day)).toEqual([0, 18]);
  });

  it('returnerar null för ogiltiga indata', () => {
    expect(computeHatchPlan('')).toBeNull();
    expect(computeHatchPlan('2026-02-30')).toBeNull();
    for (const days of [0, NaN, Infinity, 2.5, 366]) expect(computeHatchPlan('2026-03-01', days)).toBeNull();
  });

  it('är deterministisk — samma indata ger identisk plan', () => {
    expect(computeHatchPlan('2026-05-10')).toEqual(computeHatchPlan('2026-05-10'));
  });
});

describe('daysUntilHatch', () => {
  const plan = computeHatchPlan('2026-03-01')!;

  it('räknar hela dygn till kläckdagen', () => {
    expect(daysUntilHatch(plan, '2026-03-01')).toBe(21);
    expect(daysUntilHatch(plan, '2026-03-22')).toBe(0);
    expect(daysUntilHatch(plan, '2026-03-24')).toBe(-2);
  });

  it('returnerar null för ogiltigt referensdatum', () => {
    expect(daysUntilHatch(plan, 'igår')).toBeNull();
  });
});

describe('formatSvDate', () => {
  it('formaterar på svenska utan att krascha', () => {
    const formatted = formatSvDate('2026-03-22');
    expect(formatted).toContain('22');
    expect(formatted.toLowerCase()).toContain('mar');
  });

  it('lämnar ogiltiga strängar orörda', () => {
    expect(formatSvDate('inte ett datum')).toBe('inte ett datum');
  });
});
