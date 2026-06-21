import { describe, expect, it } from 'vitest';
import { ADDREVENUE_PRODUCTS } from '@/data/addRevenueProducts';
import { matchSmartProducts } from '@/lib/smartAffiliate';

describe('smart affiliate matching', () => {
  it('matchar beskärningsprodukter mot ett beskärningsavsnitt', () => {
    const matches = matchSmartProducts(
      ADDREVENUE_PRODUCTS,
      {
        slug: 'beskara-appeltrad',
        title: 'Så beskär du äppelträd',
        heading: 'Välj en bra sekatör',
        text: 'Beskär grenarna med en vass sekatör och ta bort döda grenar från fruktträdet.',
      },
      5,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('beskarning');
  });

  it('lägger inte in trädgårdsprodukter i ett irrelevant äggavsnitt', () => {
    const matches = matchSmartProducts(
      ADDREVENUE_PRODUCTS,
      {
        slug: 'varfor-varper-honan-inte',
        title: 'Varför värper hönan inte?',
        heading: 'Ljus och värpning',
        text: 'Hönans äggproduktion påverkas av dagsljus, ålder, stress och flockens hälsa.',
      },
      5,
    );

    expect(matches).toHaveLength(0);
  });

  it('kräver bild och trackinglänk för fallback-produkterna', () => {
    for (const product of ADDREVENUE_PRODUCTS) {
      expect(product.imageUrl.startsWith('http')).toBe(true);
      expect(product.trackingUrl.startsWith('https://addrevenue.io/')).toBe(true);
    }
  });
});
