import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AFFILIATE_ENABLED } from '@/lib/featureFlags';
import {
  ADTRACTION_SOURCE_ID,
  BONDEN_AD_ID,
  OUTL1_AD_ID,
  PLINDBERG_AD_ID,
  buildTrackedShopHref,
  rewriteNakedShopAffiliateHrefs,
} from '@/lib/adtractionShopLinks';
import {
  CONTEXTUAL_SHOP_PLACEMENTS,
  SHOP_DESTINATIONS,
  injectContextualShopPlacement,
  renderContextualShopPlacementHtml,
  shopPlacementForPath,
  trackedShopHref,
} from '@/lib/contextualShopPlacements';
import { renderBreedTopicBody, renderHomeTopicBody } from '@/lib/prerenderTopicPages';

const KILLED = /granngarden|vetzoo|wexthuset|vetapotek|dintradgard|firstvet/i;

function hrefsIn(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, '&'));
}

describe('Packet 1 contextual shop placements', () => {
  it('covers the zero-commerce public URLs and only the three curl-PASS merchants', () => {
    expect(CONTEXTUAL_SHOP_PLACEMENTS.map((placement) => placement.path)).toEqual([
      '/',
      '/honsraser',
      '/honsraser/orpington',
      '/blogg/bast-honsras-sverige',
      '/blogg/foder-till-hons-guide',
    ]);
    const merchants = new Set(CONTEXTUAL_SHOP_PLACEMENTS.flatMap((placement) => placement.links.map((link) => link.merchant)));
    expect([...merchants].sort()).toEqual(['bonden', 'outl1', 'p-lindberg']);
  });

  it('builds host/a= wraps matching the owner templates', () => {
    expect(buildTrackedShopHref('outl1', SHOP_DESTINATIONS.outl1Honshus)).toBe(
      `https://do.outl1.se/t/t?a=${OUTL1_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${SHOP_DESTINATIONS.outl1Honshus}`,
    );
    expect(buildTrackedShopHref('p-lindberg', SHOP_DESTINATIONS.plindbergHome)).toBe(
      `https://do.p-lindberg.se/t/t?a=${PLINDBERG_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${encodeURIComponent(SHOP_DESTINATIONS.plindbergHome)}`,
    );
    expect(buildTrackedShopHref('bonden', SHOP_DESTINATIONS.bondenHome)).toBe(
      `https://pin.bonden.se/t/t?a=${BONDEN_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${SHOP_DESTINATIONS.bondenHome}`,
    );
  });

  it('discloses Annons and uses sponsored rel on every placement', () => {
    for (const placement of CONTEXTUAL_SHOP_PLACEMENTS) {
      const html = renderContextualShopPlacementHtml(placement);
      expect(html).toContain('Annons');
      expect(html).toContain('aria-label="Annons"');
      expect(html).toContain(placement.body);
      expect(html).toMatch(/rel="sponsored noopener noreferrer"/);
      expect(html).not.toMatch(KILLED);
      for (const href of hrefsIn(html)) {
        expect(href).toMatch(/\/t\/t\?a=/);
        expect(href).toContain(`as=${ADTRACTION_SOURCE_ID}`);
      }
    }
  });

  it('injects only the registered blog slugs and is idempotent', () => {
    const ras = injectContextualShopPlacement('<p>Hedemora och Orpington är härdiga raser.</p>', 'bast-honsras-sverige');
    expect(ras).toContain('Annons');
    expect(ras).toContain('do.p-lindberg.se/t/t?a=1954027467');
    expect(injectContextualShopPlacement(ras, 'bast-honsras-sverige')).toBe(ras);

    const foder = injectContextualShopPlacement('<p>Räkna på säcken.</p>', 'foder-till-hons-guide');
    expect(foder).toContain('pin.bonden.se/t/t?a=1960530621');
    expect(foder).toContain('do.p-lindberg.se/t/t?a=1954027467');
    expect(foder).toContain(encodeURIComponent(SHOP_DESTINATIONS.plindbergFodertraag));

    // Sammanslagna nybörjarguider (308 till /blogg/skaffa-hons-nyborjare) får inga egna placeringar.
    expect(injectContextualShopPlacement('<p>Första flocken.</p>', 'skaffa-hons-nyborjarguide')).toBe('<p>Första flocken.</p>');
    expect(injectContextualShopPlacement('<p>Hobbyflock.</p>', 'hobbyhons-nyborjarguide')).toBe('<p>Hobbyflock.</p>');

    expect(injectContextualShopPlacement('<p>Orpington är en tung ras.</p>', 'orpington')).toBe(
      '<p>Orpington är en tung ras.</p>',
    );
    expect(injectContextualShopPlacement('<p>Ingen butik.</p>', 'bygga-honshus')).toBe('<p>Ingen butik.</p>');
    expect(injectContextualShopPlacement('<p>Säljsida.</p>', 'salja-agg')).toBe('<p>Säljsida.</p>');
  });

  it('does not let the wrap helper invent shop links on the zero-commerce blog slugs', () => {
    const source = '<p>Hedemora och Orpington är härdiga raser.</p>';
    expect(rewriteNakedShopAffiliateHrefs(source, 'bast-honsras-sverige')).toBe(source);
  });

  it('keeps killed merchants out of the catalog', () => {
    expect(AFFILIATE_ENABLED).toBe(true);
    const blob = JSON.stringify(CONTEXTUAL_SHOP_PLACEMENTS);
    expect(blob).not.toMatch(KILLED);
    expect(Object.values(SHOP_DESTINATIONS).join(' ')).not.toMatch(KILLED);
  });

  it('adds first-byte Annons wraps on home and the two breed prerender bodies', () => {
    const home = renderHomeTopicBody();
    expect(home).toContain('Annons');
    expect(home).toContain('do.outl1.se/t/t?a=1728546059');
    expect(home).toContain('do.p-lindberg.se/t/t?a=1954027467');
    expect(home).not.toMatch(KILLED);


    const orpington = renderBreedTopicBody({ slug: 'orpington', namn: 'Orpington', description: 'Fluffig.', faq: [] });
    expect(orpington).toContain('pin.bonden.se/t/t?a=1960530621');
    expect(orpington).toContain('url=https://www.bonden.se/');

    const sussex = renderBreedTopicBody({ slug: 'sussex', namn: 'Sussex', description: 'Nyfiken.', faq: [] });
    expect(sussex).not.toContain('data-shop-placement');
  });

  it('wires GuideArticle, prerender, and the three React surfaces', () => {
    const article = readFileSync(join(process.cwd(), 'src/pages/GuideArticle.tsx'), 'utf8');
    const prerender = readFileSync(join(process.cwd(), 'scripts/prerender-blog-posts.mjs'), 'utf8');
    expect(article).not.toContain('injectContextualShopPlacement');
    expect(article).toContain('<RecommendedProducts');
    // Outl1 (and every other program) click attribution goes through the shared host map.
    expect(article).toContain('shopMerchantFromHref(href)');
    expect(article).not.toContain('AffiliateProductStrip');
    expect(prerender).not.toContain('injectContextualShopPlacement');

    expect(readFileSync(join(process.cwd(), 'src/pages/IndexUpdated.tsx'), 'utf8')).toContain('ContextualShopCta');
    expect(readFileSync(join(process.cwd(), 'src/pages/HonsrasLanding.tsx'), 'utf8')).toContain('ContextualShopCta');
    expect(readFileSync(join(process.cwd(), 'src/pages/SaljaAgg.tsx'), 'utf8')).not.toContain('ContextualShopCta');
    expect(prerender).not.toContain("page.path === '/salja-agg'");
  });

  it('maps each target URL to the intended merchants', () => {
    expect(shopPlacementForPath('/')?.links.map((link) => link.merchant)).toEqual(['outl1', 'p-lindberg']);
    expect(shopPlacementForPath('/honsraser')?.links.map((link) => link.merchant)).toEqual(['p-lindberg']);
    expect(shopPlacementForPath('/honsraser/orpington')?.links.map((link) => link.merchant)).toEqual(['bonden']);
    expect(shopPlacementForPath('/blogg/bast-honsras-sverige')?.links.map((link) => link.merchant)).toEqual(['p-lindberg']);
    expect(shopPlacementForPath('/blogg/foder-till-hons-guide')?.links.map((link) => link.merchant)).toEqual([
      'bonden',
      'p-lindberg',
    ]);
    expect(shopPlacementForPath('/salja-agg')).toBeUndefined();
    expect(shopPlacementForPath('/blogg/skaffa-hons-nyborjarguide')).toBeUndefined();
    expect(shopPlacementForPath('/blogg/hobbyhons-nyborjarguide')).toBeUndefined();
    expect(shopPlacementForPath('/honsraser/brahma')).toBeUndefined();
    expect(trackedShopHref(shopPlacementForPath('/honsraser/orpington')!.links[0])).toContain('pin.bonden.se');
  });
});
