import { describe, expect, it } from 'vitest';
import { normalizeShopText, searchShopProducts, shopSearchSuggestions, type SearchProduct } from '../shop/search';

const product = (name: string, overrides: Partial<SearchProduct> = {}): SearchProduct => ({
  name, category: 'Tillbehör', description: '', price_ore: 1000, featured: false, sort_order: 0, ...overrides,
});

describe('SearchLift shop relevance', () => {
  it('normalizes Swedish accents, case and whitespace', () => {
    expect(normalizeShopText('  HÖNS Å Ä Ö é  ')).toBe('hons a a o e');
    expect(searchShopProducts([product('Värprede')], 'varprede')).toHaveLength(1);
  });
  it.each([['hönsfoder', 'Foder'], ['foder', 'Hönsfoder'], ['rede', 'Värprede'],
    ['värprede', 'Rede'], ['vattenautomat', 'Vattenbehållare'], ['vattenbehållare', 'Vattenautomat']])('matches synonym %s to %s', (query, name) => {
    expect(searchShopProducts([product(name)], query).map((p) => p.name)).toEqual([name]);
  });
  it('matches words inside Swedish compound names, ranked after prefixes', () => {
    expect(searchShopProducts([product('Äggkartong')], 'kartong')).toHaveLength(1);
    expect(searchShopProducts([product('Vattenautomat')], 'automat')).toHaveLength(1);
    expect(searchShopProducts([product('Kycklingfoder')], 'foder')).toHaveLength(1);
    expect(searchShopProducts([product('Foder'), product('Kycklingfoder')], 'foder').map((p) => p.name))
      .toEqual(['Foder', 'Kycklingfoder']);
  });
  it('ranks name ahead of category ahead of description, regardless of featured', () => {
    const rows = [product('C', { description: 'foder', featured: true }),
      product('B', { category: 'Foder' }), product('Foder')];
    expect(searchShopProducts(rows, 'foder').map((p) => p.name)).toEqual(['Foder', 'B', 'C']);
  });
  it('ranks exact name ahead of synonym and prefix matches', () => {
    const rows = [product('Foderautomat'), product('Hönsfoder'), product('Foder')];
    expect(searchShopProducts(rows, 'foder').map((p) => p.name)).toEqual(['Foder', 'Hönsfoder', 'Foderautomat']);
  });
  it('requires all tokens and returns no results for unknown text', () => {
    expect(searchShopProducts([product('Foder')], 'foder vatten')).toEqual([]);
    expect(searchShopProducts([product('Foder')], 'okänd')).toEqual([]);
  });
  it('preserves recommended ordering for empty queries and handles an empty catalog', () => {
    expect(searchShopProducts([product('B'), product('A', { featured: true })], '  ').map((p) => p.name)).toEqual(['A', 'B']);
    expect(searchShopProducts([], 'foder')).toEqual([]);
  });
  it('applies category filtering together with relevance', () => {
    const rows = [product('Foder', { category: 'Mat' }), product('Hönsfoder')];
    expect(searchShopProducts(rows, 'foder', 'Tillbehör').map((p) => p.name)).toEqual(['Hönsfoder']);
  });
  it('honors explicit price ordering even during a search', () => {
    const rows = [product('Foder', { price_ore: 3000 }), product('Hönsfoder', { price_ore: 1000 })];
    expect(searchShopProducts(rows, 'foder', 'all', 'price_asc').map((p) => p.price_ore)).toEqual([1000, 3000]);
    expect(searchShopProducts(rows, 'foder', 'all', 'price_desc').map((p) => p.price_ore)).toEqual([3000, 1000]);
  });
  it('preserves existing newest ordering without mutating the catalog', () => {
    const rows = [product('A', { sort_order: 1 }), product('B', { sort_order: 2 })];
    expect(searchShopProducts(rows, '', 'all', 'newest').map((p) => p.name)).toEqual(['B', 'A']);
    expect(rows.map((p) => p.name)).toEqual(['A', 'B']);
  });
  it('only suggests actual catalog names within the category', () => {
    expect(shopSearchSuggestions([product('Foder'), product('Rede', { category: 'Bo' })], 'Bo')).toEqual(['Rede']);
    expect(shopSearchSuggestions([])).toEqual([]);
  });
});