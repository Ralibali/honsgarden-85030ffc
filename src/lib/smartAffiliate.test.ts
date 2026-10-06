import { describe, expect, it } from 'vitest';
import { ADDREVENUE_PRODUCTS } from '@/data/addRevenueProducts';
import { matchSmartProducts, type SmartAffiliateProduct } from '@/lib/smartAffiliate';

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

  const product = (overrides: Partial<SmartAffiliateProduct>): SmartAffiliateProduct => ({
    id: 'p', advertiser: 'p-lindberg', name: 'Produkt', price: '1 kr', imageUrl: 'https://x/y.jpg',
    trackingUrl: 'https://do.p-lindberg.se/t/t', keywords: [], category: 'redskap', ...overrides,
  });

  it('matchar korta ord bara som hela ord eller böjningar', () => {
    const kultivator = product({ id: 'k', name: 'Kultivator', keywords: ['jord', 'odla'], category: 'odling' });
    const regler = { slug: 'regler', title: 'Registrera höns hos Jordbruksverket', heading: 'Anmälan till Jordbruksverket', text: 'Jordbruksverket vill ha uppgifter om flockens storlek och information om platsen.' };
    expect(matchSmartProducts([kultivator], regler, 5)).toHaveLength(0);
    const odling = { slug: 'odla', title: 'Odla grönsaker', heading: 'Förbered jorden', text: 'Luckra jorden innan du sår och rensa bort ogräs ur rabatten.' };
    expect(matchSmartProducts([kultivator], odling, 5).map((item) => item.id)).toEqual(['k']);
  });

  it('kräver träff på själva produkten, inte bara på kategorin', () => {
    const trag = product({ id: 't', name: 'Fodertråg', keywords: ['fodertråg'], category: 'foder' });
    const generic = { slug: 'rutiner', title: 'Rutiner i hönsgården', heading: 'Foder och mat', text: 'Ge foder på samma tid varje dag och notera hur mycket mat som går åt.' };
    expect(matchSmartProducts([trag], generic, 5)).toHaveLength(0);
    const specific = { ...generic, heading: 'Välj ett fodertråg som inte spiller' };
    expect(matchSmartProducts([trag], specific, 5).map((item) => item.id)).toEqual(['t']);
  });
});

