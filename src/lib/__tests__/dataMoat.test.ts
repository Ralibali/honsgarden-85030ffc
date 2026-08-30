import { describe, expect, it } from 'vitest';
import {
  buildRegionLiquidity,
  getLiquidityState,
  LIQUIDITY_THRESHOLDS,
  summarizeLiquidity,
} from '../marketplaceLiquidity';
import {
  AGG_INDEX_THRESHOLDS,
  computeAggIndex,
  getAggIndexState,
  mayComputeIndex,
  mayPublishIndex,
} from '../aggIndex';
import { buildPremiumInsights, type InsightEgg, type InsightHen, type InsightFeedRecord } from '../premiumInsights';

describe('marketplace liquidity', () => {
  it('maps listing counts to states', () => {
    expect(getLiquidityState(0, 99)).toBe('NO_SUPPLY');
    expect(getLiquidityState(1, 0)).toBe('BUILDING');
    expect(getLiquidityState(2, 0)).toBe('BUILDING');
    expect(getLiquidityState(3, 0)).toBe('ACTIVE');
    expect(getLiquidityState(4, 100)).toBe('ACTIVE'); // strong kräver 5 annonser
    expect(getLiquidityState(5, 4)).toBe('ACTIVE'); // ...och 5 kontakter
    expect(getLiquidityState(5, 5)).toBe('STRONG');
  });

  it('builds per-region view counting only active listings', () => {
    const view = buildRegionLiquidity(
      [
        { region: 'Östergötland', status: 'active' },
        { region: 'Östergötland', status: 'active' },
        { region: 'Östergötland', status: 'active' },
        { region: 'Östergötland', status: 'sold' }, // räknas inte
        { region: 'Skåne', status: 'active' },
        { region: 'Skåne', status: null }, // okänt → räknas som aktiv
        { region: null, status: 'active' }, // utan region → ignoreras
      ],
      [{ region: 'Östergötland' }, { region: 'Östergötland' }],
    );
    const o = view.find((r) => r.region === 'Östergötland');
    const s = view.find((r) => r.region === 'Skåne');
    expect(o).toEqual({ region: 'Östergötland', activeListings: 3, contacts30d: 2, state: 'ACTIVE' });
    expect(s).toEqual({ region: 'Skåne', activeListings: 2, contacts30d: 0, state: 'BUILDING' });
    expect(view).toHaveLength(2);
  });

  it('summarizes distribution', () => {
    const summary = summarizeLiquidity([
      { region: 'A', activeListings: 0, contacts30d: 0, state: 'NO_SUPPLY' },
      { region: 'B', activeListings: 1, contacts30d: 0, state: 'BUILDING' },
      { region: 'C', activeListings: 5, contacts30d: 9, state: 'STRONG' },
    ]);
    expect(summary).toEqual({ regions: 3, noSupply: 1, building: 1, active: 0, strong: 1 });
  });

  it('exposes sane thresholds', () => {
    expect(LIQUIDITY_THRESHOLDS.activeMinListings).toBeGreaterThan(LIQUIDITY_THRESHOLDS.buildingMinListings);
    expect(LIQUIDITY_THRESHOLDS.strongMinListings).toBeGreaterThan(LIQUIDITY_THRESHOLDS.activeMinListings);
  });
});

describe('äggindex gates', () => {
  it('requires internal-beta data before any index exists', () => {
    expect(getAggIndexState(0, 0, 0)).toBe('INSUFFICIENT_DATA');
    expect(
      getAggIndexState(
        AGG_INDEX_THRESHOLDS.internalBeta.minSellers - 1,
        AGG_INDEX_THRESHOLDS.internalBeta.minRegions,
        AGG_INDEX_THRESHOLDS.internalBeta.minSamples,
      ),
    ).toBe('INSUFFICIENT_DATA');
    // Alla tre krav måste vara uppfyllda samtidigt
    expect(getAggIndexState(999, 999, 0)).toBe('INSUFFICIENT_DATA');
    expect(getAggIndexState(999, 0, 999)).toBe('INSUFFICIENT_DATA');
  });

  it('promotes to internal beta at thresholds and public at higher thresholds', () => {
    expect(
      getAggIndexState(
        AGG_INDEX_THRESHOLDS.internalBeta.minSellers,
        AGG_INDEX_THRESHOLDS.internalBeta.minRegions,
        AGG_INDEX_THRESHOLDS.internalBeta.minSamples,
      ),
    ).toBe('INTERNAL_BETA');
    expect(
      getAggIndexState(
        AGG_INDEX_THRESHOLDS.publicEligible.minSellers,
        AGG_INDEX_THRESHOLDS.publicEligible.minRegions,
        AGG_INDEX_THRESHOLDS.publicEligible.minSamples,
      ),
    ).toBe('PUBLIC_ELIGIBLE');
    expect(mayComputeIndex(0, 0, 0)).toBe(false);
    expect(
      mayComputeIndex(
        AGG_INDEX_THRESHOLDS.internalBeta.minSellers,
        AGG_INDEX_THRESHOLDS.internalBeta.minRegions,
        AGG_INDEX_THRESHOLDS.internalBeta.minSamples,
      ),
    ).toBe(true);
    expect(
      mayPublishIndex(
        AGG_INDEX_THRESHOLDS.internalBeta.minSellers,
        AGG_INDEX_THRESHOLDS.internalBeta.minRegions,
        AGG_INDEX_THRESHOLDS.internalBeta.minSamples,
      ),
    ).toBe(false);
    expect(
      mayPublishIndex(
        AGG_INDEX_THRESHOLDS.publicEligible.minSellers,
        AGG_INDEX_THRESHOLDS.publicEligible.minRegions,
        AGG_INDEX_THRESHOLDS.publicEligible.minSamples,
      ),
    ).toBe(true);
  });

  it('computes median and quartiles without fabricating data', () => {
    expect(computeAggIndex([])).toBeNull();
    expect(computeAggIndex([0, -5, Number.NaN])).toBeNull(); // skräpdata fabricerar inget index
    const odd = computeAggIndex([10, 30, 20]);
    expect(odd).not.toBeNull();
    expect(odd?.medianSek).toBe(20);
    expect(odd?.n).toBe(3);
    const even = computeAggIndex([10, 20, 30, 40]);
    expect(even?.medianSek).toBe(25);
    expect(even?.p25Sek).toBeGreaterThan(10);
    expect(even?.p75Sek).toBeLessThan(40);
    expect(even?.p25Sek).toBeLessThanOrEqual(even?.p75Sek ?? 0);
  });
});

describe('premium insights', () => {
  const henA: InsightHen = { id: 'h1', name: 'Agda' };
  const henB: InsightHen = { id: 'h2', name: 'Beda' };
  const TODAY = '2026-03-15';

  const daysAgo = (n: number): string => {
    const t = Date.parse(`${TODAY}T12:00:00Z`) - n * 86400000;
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  const egg = (date: string, henId: string | null, count = 1): InsightEgg => ({
    date,
    hen_id: henId,
    count,
  });

  it('returns nothing without data', () => {
    expect(buildPremiumInsights([], [], [], TODAY)).toEqual([]);
    expect(buildPremiumInsights([egg(TODAY, 'h1')], [], [], TODAY)).toEqual([]);
  });

  it('surfaces the week’s best layer when at least two hens are tracked', () => {
    const eggs: InsightEgg[] = [
      egg(daysAgo(1), 'h1'), egg(daysAgo(2), 'h1'), egg(daysAgo(3), 'h1'),
      egg(daysAgo(1), 'h2'),
    ];
    const insights = buildPremiumInsights(eggs, [henA, henB], [], TODAY);
    const best = insights.find((i) => i.id === 'best_layer_week');
    expect(best).toBeDefined();
    expect(best?.body).toContain('Agda');
    expect(best?.body).toContain('3 ägg');
  });

  it('requires two hens before naming a best layer', () => {
    const eggs: InsightEgg[] = [egg(daysAgo(1), 'h1'), egg(daysAgo(2), 'h1')];
    const insights = buildPremiumInsights(eggs, [henA], [], TODAY);
    expect(insights.some((i) => i.id === 'best_layer_week')).toBe(false);
  });

  it('detects flock trend direction in both directions and stays silent on ties', () => {
    const up: InsightEgg[] = [
      ...Array.from({ length: 6 }, (_, i) => egg(daysAgo(i + 1), 'h1')),
      ...Array.from({ length: 3 }, (_, i) => egg(daysAgo(i + 8), 'h1')),
    ];
    const upTrend = buildPremiumInsights(up, [henA], [], TODAY).find((i) => i.id === 'flock_trend');
    expect(upTrend?.body).toContain('fler ägg');

    const down: InsightEgg[] = [
      ...Array.from({ length: 2 }, (_, i) => egg(daysAgo(i + 1), 'h1')),
      ...Array.from({ length: 7 }, (_, i) => egg(daysAgo(i + 8), 'h1')),
    ];
    const downTrend = buildPremiumInsights(down, [henA], [], TODAY).find((i) => i.id === 'flock_trend');
    expect(downTrend?.body).toContain('färre ägg');

    const tie: InsightEgg[] = [
      ...Array.from({ length: 4 }, (_, i) => egg(daysAgo(i + 1), 'h1')),
      ...Array.from({ length: 4 }, (_, i) => egg(daysAgo(i + 8), 'h1')),
    ];
    expect(buildPremiumInsights(tie, [henA], [], TODAY).some((i) => i.id === 'flock_trend')).toBe(false);
  });

  it('flags a best-ever week only with enough history and only when actually best', () => {
    // 5 veckor historik, innevarande rullande vecka bäst
    const eggs: InsightEgg[] = [];
    for (let w = 0; w < 5; w += 1) {
      for (let d = 0; d < 3 + (w === 0 ? 4 : 0); d += 1) {
        eggs.push(egg(daysAgo(w * 7 + d + 1), 'h1'));
      }
    }
    expect(buildPremiumInsights(eggs, [henA], [], TODAY).some((i) => i.id === 'best_week_ever')).toBe(true);

    // Svag innevarande vecka → ingen rekordnotis
    const weak: InsightEgg[] = [];
    for (let w = 0; w < 5; w += 1) {
      for (let d = 0; d < (w === 0 ? 1 : 5); d += 1) {
        weak.push(egg(daysAgo(w * 7 + d + 1), 'h1'));
      }
    }
    expect(buildPremiumInsights(weak, [henA], [], TODAY).some((i) => i.id === 'best_week_ever')).toBe(false);

    // För kort historik (<28 dagar) → aldrig rekordnotis
    const short: InsightEgg[] = Array.from({ length: 7 }, (_, i) => egg(daysAgo(i), 'h1', 5));
    expect(buildPremiumInsights(short, [henA], [], TODAY).some((i) => i.id === 'best_week_ever')).toBe(false);
  });

  it('computes cost per egg only with dated feed cost and enough eggs', () => {
    const eggs: InsightEgg[] = Array.from({ length: 35 }, (_, i) => egg(daysAgo((i % 28) + 1), 'h1'));
    const feed: InsightFeedRecord[] = [{ date: daysAgo(10), cost_sek: 150 }];
    const cost = buildPremiumInsights(eggs, [henA], feed, TODAY).find((i) => i.id === 'cost_per_egg');
    expect(cost).toBeDefined();
    expect(cost?.body).toMatch(/\d+,\d{2} kr\/ägg/);
    expect(cost?.body).toContain('150 kr foder');

    // Utan foderkostnad → ingen notis
    expect(buildPremiumInsights(eggs, [henA], [], TODAY).some((i) => i.id === 'cost_per_egg')).toBe(false);
    // Odaterad foderpost → konservativt bortfiltrerad
    expect(
      buildPremiumInsights(eggs, [henA], [{ cost_sek: 150 }], TODAY).some((i) => i.id === 'cost_per_egg'),
    ).toBe(false);
    // För få ägg → ingen notis
    const few = eggs.slice(0, 10);
    expect(buildPremiumInsights(few, [henA], feed, TODAY).some((i) => i.id === 'cost_per_egg')).toBe(false);
  });

  it('ignores zero-count rows', () => {
    const eggs: InsightEgg[] = [egg(daysAgo(1), 'h1', 0), egg(daysAgo(2), 'h1', 2), egg(daysAgo(2), 'h2', 1)];
    const insights = buildPremiumInsights(eggs, [henA, henB], [], TODAY);
    const best = insights.find((i) => i.id === 'best_layer_week');
    expect(best?.body).toContain('2 ägg');
  });
});
