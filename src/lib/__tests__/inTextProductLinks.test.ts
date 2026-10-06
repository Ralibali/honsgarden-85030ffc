import { describe, expect, it } from 'vitest';
import { linkProductMentions, maxInTextProductLinks } from '@/lib/inTextProductLinks';
import { advertiserFromTrackingUrl, mapDatabaseProduct } from '@/lib/affiliateCatalog';
import { matchSmartProducts, type SmartAffiliateProduct } from '@/lib/smartAffiliate';

const product = (overrides: Partial<SmartAffiliateProduct>): SmartAffiliateProduct => ({
  id: 'p', advertiser: 'p-lindberg', name: 'Produkt', price: '1 kr', imageUrl: 'https://x/y.jpg',
  trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&url=x', keywords: [], category: 'redskap', ...overrides,
});

const vattenautomat = product({ id: 'va', name: 'Vattenautomat för höns – 5 liter', keywords: ['vattenautomat', 'vatten'], category: 'vatten' });
const varmelampa = product({ id: 'vl', name: 'Värmelampa 150 W för höns', keywords: ['värmelampa', 'värme'], category: 'vaerme' });
const catalog = [vattenautomat, varmelampa];
const ctx = { slug: 'hons-pa-vintern', title: 'Höns på vintern', max: 3 };

describe('linkProductMentions', () => {
  it('links the first mention of a product type to a matching product', () => {
    const html = '<p>En vattenautomat som inte fryser är guld värd på vintern. Fyll vattenautomaten varje dag.</p>';
    const out = linkProductMentions(html, catalog, ctx);
    expect(out.match(/<a /g)).toHaveLength(1);
    expect(out).toContain('rel="sponsored noopener"');
    expect(out).toContain('data-intext-product="va"');
    expect(out).toContain('>vattenautomat</a> som inte fryser');
    expect(out.replace(/<[^>]+>/g, '')).toBe(html.replace(/<[^>]+>/g, ''));
  });

  it('matches inflected forms and keeps the original casing', () => {
    const out = linkProductMentions('<p>Värmelamporna drar mycket ström.</p>', catalog, ctx);
    expect(out).toContain('>Värmelamporna</a>');
  });

  it('never links inside headings, existing links or captions', () => {
    const html = '<h2>Välj vattenautomat</h2><p><a href="/blogg/x">vattenautomat</a></p><figure><figcaption>En värmelampa</figcaption></figure>';
    expect(linkProductMentions(html, catalog, ctx)).toBe(html);
  });

  it('does not link words inside other words or without a matching product', () => {
    const html = '<p>Hönsvattenautomatik och ett fodertråg.</p>';
    expect(linkProductMentions(html, catalog, ctx)).toBe(html);
  });

  it('respects the per-article limit and links each product type once', () => {
    const html = '<p>En vattenautomat.</p><p>En värmelampa.</p><p>En vattenautomat till.</p>';
    expect(linkProductMentions(html, catalog, { ...ctx, max: 1 }).match(/<a /g)).toHaveLength(1);
    expect(linkProductMentions(html, catalog, ctx).match(/<a /g)).toHaveLength(2);
    expect(maxInTextProductLinks('<p>kort</p>')).toBe(1);
    expect(maxInTextProductLinks(`<p>${'ord '.repeat(2000)}</p>`)).toBe(3);
  });
});

describe('catalog safety', () => {
  it('names the merchant from the tracking link when the advertiser relation is hidden', () => {
    expect(advertiserFromTrackingUrl('https://do.p-lindberg.se/t/t?a=1954027468&cupa_sku=1')).toBe('p-lindberg');
    expect(advertiserFromTrackingUrl('https://pin.bonden.se/t/t?a=1')).toBe('bonden');
    expect(advertiserFromTrackingUrl('https://addrevenue.io/t?c=3467121&a=984666&m=SE')).toBe('by-benson');
    expect(advertiserFromTrackingUrl('https://example.com/x')).toBeNull();
    const mapped = mapDatabaseProduct({ id: 1, name: 'Fodertråg', image_url: 'https://x/y.jpg', affiliate_url: 'https://do.p-lindberg.se/t/t?a=1&cupa_sku=9', external_id: '9', affiliate_advertisers: null });
    expect(mapped?.advertiser).toBe('p-lindberg');
  });

  it('never suggests slaughter equipment automatically', () => {
    const bolt = product({ id: 'b', name: 'Bultpistol för höns och kaniner', keywords: ['höns', 'behandling'], category: 'redskap' });
    const context = { slug: 'kvalster-hons', title: 'Kvalster hos höns', heading: 'Behandling – steg för steg', text: 'Behandla hönshuset och hönsen mot kvalster, rengör sittpinnar och redskap.' };
    expect(matchSmartProducts([bolt], context, 5)).toHaveLength(0);
  });
});

describe('affiliate network links', () => {
  it('maps Awin clicks to their merchant id', () => {
    expect(advertiserFromTrackingUrl('https://www.awin1.com/cread.php?awinmid=12345&awinaffid=1&ued=x')).toBe('awin-12345');
  });
});
