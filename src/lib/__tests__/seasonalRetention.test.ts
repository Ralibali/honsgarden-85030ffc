import { describe, it, expect, beforeEach } from 'vitest';
import { getSeasonalMode, getSeasonalGuidance, trackSeasonalModeIfChanged } from '../seasonalMode';
import { daysBetweenIso, getLogRecency, lastLogDateFromEggs } from '../retentionLoop';

describe('getSeasonalMode', () => {
  it.each([
    ['2026-01-15', 'winter'],
    ['2026-03-31', 'winter'],
    ['2026-04-01', 'spring'],
    ['2026-05-20', 'spring'],
    ['2026-06-15', 'summer'],
    ['2026-08-30', 'summer'],
    ['2026-09-01', 'autumn'],
    ['2026-10-31', 'autumn'],
    ['2026-11-01', 'winter'],
    ['2026-12-24', 'winter'],
  ])('%s → %s', (iso, expected) => {
    expect(getSeasonalMode(new Date(`${iso}T12:00:00`))).toBe(expected);
  });
});

describe('getSeasonalGuidance', () => {
  it('ger alltid svensk copy med titel, brödtext och CTA', () => {
    for (const mode of ['winter', 'spring', 'summer', 'autumn'] as const) {
      const g = getSeasonalGuidance(mode);
      expect(g.title.length).toBeGreaterThan(5);
      expect(g.body.length).toBeGreaterThan(40);
      expect(g.ctaHref.startsWith('/')).toBe(true);
      expect(g.ctaLabel.length).toBeGreaterThan(3);
    }
  });

  it('vinter-copyn lugnar ("normalt") utan påhittade siffror', () => {
    const g = getSeasonalGuidance('winter');
    expect(g.body).toContain('normalt');
    expect(g.body).not.toMatch(/\d+\s*%/); // inga fabricerade procenttal
  });
});

describe('trackSeasonalModeIfChanged', () => {
  beforeEach(() => localStorage.clear());

  it('skickar event bara vid faktiskt säsongsskifte', () => {
    const calls: string[] = [];
    window.plausible = ((event: string) => { calls.push(event); }) as typeof window.plausible;
    trackSeasonalModeIfChanged('winter');
    trackSeasonalModeIfChanged('winter');
    trackSeasonalModeIfChanged('spring');
    expect(calls).toEqual(['Seasonal Mode Changed', 'Seasonal Mode Changed']);
    delete window.plausible;
  });
});

describe('daysBetweenIso', () => {
  it('räknar hela dygn mellan datum', () => {
    expect(daysBetweenIso('2026-03-01', '2026-03-01')).toBe(0);
    expect(daysBetweenIso('2026-03-01', '2026-03-05')).toBe(4);
    expect(daysBetweenIso('2025-12-31', '2026-01-02')).toBe(2);
  });

  it('returnerar null för ogiltiga datum', () => {
    expect(daysBetweenIso('igår', '2026-03-01')).toBeNull();
  });
});

describe('getLogRecency', () => {
  const today = '2026-03-10';

  it('klassar rätt tillstånd per dagavstånd', () => {
    expect(getLogRecency('2026-03-10', today).state).toBe('logged_today');
    expect(getLogRecency('2026-03-09', today).state).toBe('active');
    expect(getLogRecency('2026-03-08', today).state).toBe('gentle_reminder');
    expect(getLogRecency('2026-03-06', today).state).toBe('at_risk');
    expect(getLogRecency('2026-02-20', today).state).toBe('dormant');
    expect(getLogRecency(null, today).state).toBe('dormant');
  });

  it('lägger till vinter-lugnet i nudge-copyn under vinterläge', () => {
    const winter = getLogRecency('2026-03-05', today, 'winter');
    const summer = getLogRecency('2026-03-05', today, 'summer');
    expect(winter.body).toContain('normalt');
    expect(summer.body).not.toContain('normalt');
  });

  it('tom copy i lugna tillstånd (inget brus)', () => {
    expect(getLogRecency('2026-03-10', today).title).toBe('');
    expect(getLogRecency('2026-03-09', today).body).toBe('');
  });
});

describe('lastLogDateFromEggs', () => {
  it('hittar senaste datumet oavsett ordning', () => {
    expect(lastLogDateFromEggs([
      { date: '2026-03-01', count: 2 },
      { date: '2026-03-07', count: 1 },
      { date: '2026-03-05', count: 3 },
    ])).toBe('2026-03-07');
  });

  it('hoppar över noll-loggar och tomma rader', () => {
    expect(lastLogDateFromEggs([
      { date: '2026-03-09', count: 0 },
      { date: '2026-03-02', count: 2 },
      { date: null, count: 1 },
    ])).toBe('2026-03-02');
    expect(lastLogDateFromEggs([])).toBeNull();
  });
});
