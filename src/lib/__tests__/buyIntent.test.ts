import { describe, it, expect } from 'vitest';
import { computeBuyIntent, shouldShowRecommendedProducts } from '@/lib/buyIntent';

describe('buyIntent', () => {
  it('suppresses health-category articles', () => {
    const r = computeBuyIntent({ title: 'Röd luftstrupsmilbe hos hönor', slug: 'sjuk-hona', category: 'halsa' });
    expect(r.suppress).toBe(true);
  });

  it('gives high score to buy-guide titles', () => {
    const r = computeBuyIntent({
      title: 'Bästa hönshuset 2026 – köpguide och jämförelse',
      slug: 'basta-honshuset-2026-kopguide',
    });
    expect(r.score).toBeGreaterThanOrEqual(6);
    expect(r.suppress).toBe(false);
  });

  it('gives low score to opinion articles', () => {
    const r = computeBuyIntent({ title: 'Hur jag lärde mig älska mina hönor', slug: 'karlek-honor' });
    expect(r.score).toBeLessThan(6);
  });

  it('shouldShowRecommendedProducts requires enough products AND intent', () => {
    const input = { title: 'Bästa hönshuset 2026 köpguide', slug: 'basta-honshuset' };
    expect(shouldShowRecommendedProducts(input, 1)).toBe(false);
    expect(shouldShowRecommendedProducts(input, 3)).toBe(true);
  });

  it('never shows on health articles regardless of matches', () => {
    expect(
      shouldShowRecommendedProducts({ title: 'Sjukdomar hos höns', slug: 'sjukdomar', category: 'halsa' }, 5),
    ).toBe(false);
  });
});
