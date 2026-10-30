import { describe, expect, it } from 'vitest';
import { buildFarmPulse, computeMonthPace, productionChange, type PulseEgg } from '@/lib/farmPulse';
import type { FeedForecast } from '@/lib/feedForecast';

const TODAY = '2026-06-15';

function eggsFor(days: Array<[daysAgo: number, count: number]>, today = TODAY): PulseEgg[] {
  const base = Date.parse(`${today}T12:00:00Z`);
  return days.map(([ago, count]) => ({ date: new Date(base - ago * 86_400_000).toISOString().slice(0, 10), count }));
}

function steady(fromAgo: number, toAgo: number, count: number) {
  const rows: Array<[number, number]> = [];
  for (let ago = fromAgo; ago <= toAgo; ago += 1) rows.push([ago, count]);
  return rows;
}

const feed = (patch: Partial<FeedForecast>): FeedForecast => ({
  confidence: 'ok', kgPerDay: 1, kgLeft: 5, daysLeft: 5, runOutDate: '2026-06-20', lastPurchaseDate: '2026-06-01',
  stale: false, costPerEgg: null, costBasis: null, costPeriodEggs: 0, costPeriodSek: 0, ...patch,
});

describe('buildFarmPulse – påminnelser', () => {
  it('lyfter försenade påminnelser först och slår ihop resten', () => {
    const items = buildFarmPulse({
      todayIso: TODAY, season: 'summer',
      reminders: [
        { id: 'a', title: 'Avmaskning', due_date: '2026-06-10', status: 'overdue' },
        { id: 'b', title: 'Byt strö', due_date: '2026-06-15', status: 'upcoming' },
        { id: 'c', title: 'Kvalsterkoll', due_date: '2026-06-14', status: 'overdue' },
        { id: 'd', title: 'Vaccination', due_date: '2026-06-16', status: 'upcoming' },
        { id: 'e', title: 'Långt fram', due_date: '2026-07-01', status: 'upcoming' },
        { id: 'f', title: 'Redan klar', due_date: '2026-06-01', status: 'done' },
      ],
    });
    expect(items[0]).toMatchObject({ reminderId: 'a', tone: 'urgent', detail: 'Försenad 5 dagar' });
    expect(items[1]).toMatchObject({ reminderId: 'c', detail: 'Försenad 1 dag' });
    const more = items.find((i) => i.kind === 'reminders');
    expect(more?.title).toBe('2 påminnelser till');
    expect(items.some((i) => i.title === 'Långt fram' || i.title === 'Redan klar')).toBe(false);
  });
});

describe('buildFarmPulse – foder', () => {
  it('varnar när fodret räcker en vecka eller mindre', () => {
    const [item] = buildFarmPulse({ todayIso: TODAY, season: 'summer', feed: feed({ daysLeft: 5 }) });
    expect(item).toMatchObject({ kind: 'feed', tone: 'heads-up', title: 'Fodret räcker ca 5 dagar till' });
    const [urgent] = buildFarmPulse({ todayIso: TODAY, season: 'summer', feed: feed({ daysLeft: 2 }) });
    expect(urgent.tone).toBe('urgent');
  });

  it('tiger när prognosen saknas, är inaktuell eller fodret räcker länge', () => {
    for (const f of [feed({ daysLeft: 20 }), feed({ stale: true }), feed({ confidence: 'none' }), null]) {
      expect(buildFarmPulse({ todayIso: TODAY, season: 'summer', feed: f })).toEqual([]);
    }
  });
});

describe('buildFarmPulse – kläckning', () => {
  const hatch = (start: string, status = 'incubating') => ({ id: 'h1', start_date: start, expected_hatch_date: null, status, egg_count: 12 });

  it('visar ruvningsdag och nästa milstolpe', () => {
    const [item] = buildFarmPulse({ todayIso: TODAY, season: 'summer', hatchings: [hatch('2026-06-10')] });
    expect(item.title).toBe('Ruvning dag 5 av 21');
    expect(item.detail).toContain('första lysningen');
  });

  it('firar kläckdagen och ber om resultat efteråt', () => {
    const [day] = buildFarmPulse({ todayIso: TODAY, season: 'summer', hatchings: [hatch('2026-05-25')] });
    expect(day).toMatchObject({ tone: 'celebrate', title: 'Beräknad kläckdag idag 🐣' });
    const [after] = buildFarmPulse({ todayIso: TODAY, season: 'summer', hatchings: [hatch('2026-05-22')] });
    expect(after.title).toBe('Hur gick kläckningen?');
  });

  it('ignorerar avslutade kläckningar', () => {
    expect(buildFarmPulse({ todayIso: TODAY, season: 'summer', hatchings: [hatch('2026-06-10', 'completed')] })).toEqual([]);
  });
});

describe('productionChange och värpningsvarningar', () => {
  it('kräver tillräckligt med loggade dagar och räknar aldrig saknade dagar som noll', () => {
    expect(productionChange(eggsFor([...steady(1, 3, 1), ...steady(8, 28, 5)]), TODAY)).toBeNull();
    const gappy = eggsFor([...steady(1, 7, 5).filter(([ago]) => ago % 2 === 1), ...steady(8, 28, 5)]);
    expect(productionChange(gappy, TODAY)?.changePct).toBe(0);
  });

  it('flaggar ett tydligt fall på sommaren och pekar mot hälsa', () => {
    const eggs = eggsFor([...steady(1, 7, 2), ...steady(8, 28, 5)]);
    const [item] = buildFarmPulse({ todayIso: TODAY, season: 'summer', eggs });
    expect(item).toMatchObject({ kind: 'production', tone: 'heads-up', title: 'Värpningen har gått ner ca 60 %', href: '/app/halsa' });
  });

  it('lugnar i stället för att larma på vintern', () => {
    const today = '2026-12-15';
    const eggs = eggsFor([...steady(1, 7, 1), ...steady(8, 28, 4)], today);
    const [item] = buildFarmPulse({ todayIso: today, season: 'winter', eggs });
    expect(item).toMatchObject({ tone: 'calm', title: 'Lugnare i redena – helt normalt nu' });
    expect(item.href).toBeUndefined();
  });

  it('firar när flocken värper mer än vanligt', () => {
    const eggs = eggsFor([...steady(1, 7, 8), ...steady(8, 28, 5)]);
    const [item] = buildFarmPulse({ todayIso: TODAY, season: 'summer', eggs });
    expect(item).toMatchObject({ tone: 'celebrate', title: 'Flocken värper mer än vanligt' });
  });

  it('visar vinterläget när inget annat behöver sägas', () => {
    const [item] = buildFarmPulse({ todayIso: '2026-11-02', season: 'winter' });
    expect(item.kind).toBe('season');
    expect(buildFarmPulse({ todayIso: TODAY, season: 'summer' })).toEqual([]);
  });
});

describe('prioritering', () => {
  it('visar högst fyra saker, viktigast först', () => {
    const items = buildFarmPulse({
      todayIso: TODAY, season: 'summer',
      reminders: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, title: `P${id}`, due_date: `2026-06-1${i}`, status: 'overdue' })),
      feed: feed({ daysLeft: 1 }),
      hatchings: [{ id: 'h', start_date: '2026-06-10', status: 'incubating' }],
    });
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.priority)).toEqual([...items.map((i) => i.priority)].sort((a, b) => b - a));
  });
});

describe('computeMonthPace', () => {
  it('räknar ägg hittills och gör en prognos när underlaget räcker', () => {
    const eggs = eggsFor(steady(0, 9, 4).map(([ago, c]) => [ago, c] as [number, number]), '2026-11-10');
    const pace = computeMonthPace(eggs, '2026-11-10');
    expect(pace).toMatchObject({ monthLabel: 'november', soFar: 40, loggedDays: 10, elapsedDays: 10, projected: 120 });
  });

  it('avstår från prognos för den som loggar i klump', () => {
    const eggs = eggsFor([[0, 20], [7, 20]], '2026-11-10');
    expect(computeMonthPace(eggs, '2026-11-10')?.projected).toBeNull();
  });

  it('räknar inte in föregående månad', () => {
    const eggs = eggsFor(steady(0, 20, 3), '2026-11-05');
    expect(computeMonthPace(eggs, '2026-11-05')?.soFar).toBe(15);
  });
});
