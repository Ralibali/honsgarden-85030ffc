import { describe, it, expect } from 'vitest';
import { scoreProducts, pickDailyFromTopN } from '@/lib/agdaProductScoring';
import { AFFILIATE_PRODUCTS, type AffiliateProduct } from '@/data/affiliateProducts';
import type { FarmContext } from '@/lib/agdaProductScoring';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const yearsAgo = (y: number) => new Date(Date.now() - y * 365 * 86_400_000).toISOString();

const baseWeather = { hasFrostSoon: false, hasHeatwaveSoon: false } as any;

function ctx(overrides: Partial<FarmContext> = {}): FarmContext {
  return { hens: [], eggs: [], weather: baseWeather, ...overrides };
}

describe('scoreProducts', () => {
  it('föreslår startset/hus när inga höns finns', () => {
    const scored = scoreProducts(ctx({ hens: [] }));
    expect(scored.length).toBeGreaterThan(0);
    expect(['startset', 'hus']).toContain(scored[0].product.category);
    expect(scored[0].reason).toMatch(/ännu inte har registrerat/i);
  });

  it('prioriterar värme/vatten vid frostvarning', () => {
    const hens = [{ is_active: true, hen_type: 'hen', birth_date: yearsAgo(1) }];
    const scored = scoreProducts(ctx({ hens, weather: { ...baseWeather, hasFrostSoon: true } }));
    const top = scored.slice(0, 5).map((s) => s.product.category);
    expect(top.some((c) => c === 'vaerme' || c === 'vatten')).toBe(true);
  });

  it('lyfter tillskott/foder vid kraftigt produktionsfall', () => {
    const hens = [
      { is_active: true, hen_type: 'hen', birth_date: yearsAgo(1) },
      { is_active: true, hen_type: 'hen', birth_date: yearsAgo(1) },
    ];
    const eggs: any[] = [];
    for (let d = 15; d < 42; d++) eggs.push({ date: daysAgo(d), count: 2 });
    for (let d = 0; d < 14; d++) eggs.push({ date: daysAgo(d), count: 0 });
    const scored = scoreProducts(ctx({ hens, eggs }));
    const reasons = scored.slice(0, 6).map((s) => s.reason).join(' ');
    const cats = scored.slice(0, 6).map((s) => s.product.category);
    expect(cats.some((c) => c === 'tillskott' || c === 'foder')).toBe(true);
    expect(reasons).toMatch(/sjunkit|under 0,4/i);
  });

  it('respekterar inStock=false (filtrerar bort slutsålt)', () => {
    const onlyOut: AffiliateProduct[] = AFFILIATE_PRODUCTS.map((p) => ({ ...p, inStock: false }));
    expect(scoreProducts(ctx({ hens: [] }), onlyOut)).toHaveLength(0);
  });

  it('faller tillbaka på statiska katalogen när ingen lista skickas', () => {
    const scored = scoreProducts(ctx({ hens: [{ is_active: true, hen_type: 'hen', birth_date: yearsAgo(1) }] }));
    expect(scored.length).toBeGreaterThan(0);
    const ids = new Set(AFFILIATE_PRODUCTS.map((p) => p.id));
    expect(scored.every((s) => ids.has(s.product.id))).toBe(true);
  });

  it('ger varje produkt en mänsklig motivering', () => {
    const scored = scoreProducts(ctx({ hens: [] }));
    expect(scored.every((s) => s.reason.startsWith('Rekommenderas eftersom'))).toBe(true);
  });
});

describe('pickDailyFromTopN', () => {
  it('returnerar null för tom lista', () => {
    expect(pickDailyFromTopN([])).toBeNull();
  });

  it('väljer deterministiskt inom topp-N (samma dag = samma produkt)', () => {
    const scored = scoreProducts(ctx({ hens: [{ is_active: true, hen_type: 'hen', birth_date: yearsAgo(1) }] }));
    const a = pickDailyFromTopN(scored, 5);
    const b = pickDailyFromTopN(scored, 5);
    expect(a?.product.id).toBe(b?.product.id);
  });
});
