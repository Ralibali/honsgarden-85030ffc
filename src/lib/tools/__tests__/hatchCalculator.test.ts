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
  it('ger kläckdag på dag 21 räknat från startdagen som dag 1', () => {
    const plan = computeHatchPlan('2026-03-01')!;
    expect(plan.hatchDate).toBe('2026-03-21');
    expect(plan.incubationDays).toBe(CHICKEN_INCUBATION_DAYS);
  });

  it('hanterar månads- och årsskiften', () => {
    expect(computeHatchPlan('2026-12-25')!.hatchDate).toBe('2027-01-14');
    expect(computeHatchPlan('2024-02-20')!.hatchDate).toBe('2024-03-11'); // skottår
  });

  it('ger rätt milstolpar för hönsägg (21 dagar)', () => {
    const plan = computeHatchPlan('2026-03-01')!;
    const byDay = new Map(plan.milestones.map((m) => [m.day, m]));
    expect(byDay.get(1)!.label).toContain('startar');
    expect(byDay.get(7)!.label).toContain('Första lysningen');
    expect(byDay.get(14)!.label).toContain('Andra lysningen');
    expect(byDay.get(18)!.label).toContain('Sluta vändas');
    expect(byDay.get(21)!.label).toContain('kläckdag');
    expect(byDay.get(23)!.label).toContain('eftersläntrar');
    // Milstolparna ligger i dagsordning med stigande datum.
    const days = plan.milestones.map((m) => m.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it('skalar milstolparna efter andra ruvtider', () => {
    const plan = computeHatchPlan('2026-03-01', 18)!; // t.ex. vaktel
    expect(plan.hatchDate).toBe('2026-03-18');
    const lockdown = plan.milestones.find((m) => m.label.includes('Sluta vändas'))!;
    expect(lockdown.day).toBe(15); // 18 - 3
  });

  it('returnerar null för ogiltiga indata', () => {
    expect(computeHatchPlan('')).toBeNull();
    expect(computeHatchPlan('2026-02-30')).toBeNull();
    expect(computeHatchPlan('2026-03-01', 0)).toBeNull();
  });

  it('är deterministisk — samma indata ger identisk plan', () => {
    expect(computeHatchPlan('2026-05-10')).toEqual(computeHatchPlan('2026-05-10'));
  });
});

describe('daysUntilHatch', () => {
  const plan = computeHatchPlan('2026-03-01')!;

  it('räknar hela dygn till kläckdagen', () => {
    expect(daysUntilHatch(plan, '2026-03-01')).toBe(20);
    expect(daysUntilHatch(plan, '2026-03-21')).toBe(0);
    expect(daysUntilHatch(plan, '2026-03-24')).toBe(-3);
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
