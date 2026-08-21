import { describe, expect, it } from 'vitest';
import {
  ADTRACTION_SOURCE_ID,
  PLINDBERG_AD_ID,
  PLINDBERG_REWRITE_SLUGS,
  VETAPOTEK_AD_ID,
  VETAPOTEK_REWRITE_SLUGS,
  extractHrefValues,
  isNakedPLindbergShopHref,
  isNakedVetapotekShopHref,
  rewriteNakedShopAffiliateHrefs,
} from '@/lib/adtractionShopLinks';

/** Representative HTML taken from the live blog_posts content (hrefs + link text). */
const PAGE_FIXTURES: Record<string, string> = {
  'bygga-honshus':
    'stor vardagsvinst. <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Jämför hönsluckor hos P-Lindberg</a> och <a href="https://www.granngarden.se/">Granngården</a>',
  'klacka-agg':
    'Jämför gärna hos <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">P-Lindberg</a> och <a href="https://www.granngarden.se/">Granngården</a>',
  'vad-ater-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a></li><li><strong>Vitamintillskott</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a>, <a href="https://www.vetzoo.se/">Vetzoo</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://firstvet.com/sv/butik">FirstVet</a>',
  'kopa-hons':
    '<a href="https://www.granngarden.se/">Granngården</a> <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Se foderautomater hos P-Lindberg</a>',
  'vattenautomat-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a></li><li><strong>Äppelvinäger</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a> <a href="https://www.wexthuset.com/">Wexthuset</a>',
  'varmelampa-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://firstvet.com/sv/butik">FirstVet</a>',
  'varprede-hons':
    'kan du börja här: <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">jämför reden hos P-Lindberg</a> och <a href="https://www.bonden.se/">Bonden</a>',
  'sittpinnar-hons':
    '<a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a></li><li><strong>Hönshusinredning</strong> – <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/">Wexthuset</a>',
  'kalkben-hos-hons':
    '<a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a></li><li><strong>Insektsmedel</strong> – <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://firstvet.com/sv/butik">FirstVet</a>',
  'kvalster-hons':
    '<strong>Röd hönskvalstermedel</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a> <a href="https://firstvet.com/sv/butik">FirstVet</a> <a href="https://www.wexthuset.com/">Wexthuset</a>',
};

const KOPGUIDE_FIXTURE = [
  '<a href="https://do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Fwww.p-lindberg.se%2Fstartset-hoens-stort-9067619%2F">Se Startset</a>',
  '<a href="https://id.vetapotek.se/t/t?a=1701463577&amp;as=2056181186&amp;t=2&amp;tk=1&amp;cupa_sku=7330824007972&amp;url=https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/">Kiselgur</a>',
  '<a href="https://outl1.se/honshus-med-utegard?var=12423">Lyfco</a>',
  '<a href="https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-500-g-7330824007989/">500 g</a>',
].join(' ');

const NO_STORE_FIXTURES: Record<string, string> = {
  'bast-honsras-sverige': '<p>Hedemora och Orpington är härdiga raser.</p>',
  orpington: '<p>Orpington är en tung ras.</p>',
  'berakna-foderkostnad-for-hons': '<p>Räkna på säcken, inte på känsla.</p>',
};

function expectNoNakedShopHrefs(html: string, { plindberg = false, vetapotek = false } = {}) {
  const hrefs = extractHrefValues(html);
  if (plindberg) {
    expect(hrefs.filter(isNakedPLindbergShopHref), html).toEqual([]);
  }
  if (vetapotek) {
    expect(hrefs.filter(isNakedVetapotekShopHref), html).toEqual([]);
  }
}

describe('rewriteNakedShopAffiliateHrefs', () => {
  it('matches the köpguide P-Lindberg tracking style (encoded url=)', () => {
    const html = rewriteNakedShopAffiliateHrefs(
      '<a href="https://www.p-lindberg.se/hoenshus-xl-9061609/">Se huset</a>',
      'bygga-honshus',
    );
    expect(html).toContain(
      'https://do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Fwww.p-lindberg.se%2Fhoenshus-xl-9061609%2F',
    );
    expect(html).toContain(`a=${PLINDBERG_AD_ID}`);
    expect(html).toContain(`as=${ADTRACTION_SOURCE_ID}`);
  });

  it('matches existing Vetapotek Adtraction style (url= destination, not encoded)', () => {
    const html = rewriteNakedShopAffiliateHrefs(
      '<a href="https://vetapotek.se/">Vetapotek.se</a>',
      'kvalster-hons',
    );
    expect(html).toContain(
      `https://id.vetapotek.se/t/t?a=${VETAPOTEK_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https://vetapotek.se/`,
    );
  });

  it.each(PLINDBERG_REWRITE_SLUGS)(
    'rewrites every naked P-Lindberg shop href on %s and keeps link text',
    (slug) => {
      const source = PAGE_FIXTURES[slug];
      expect(source, `missing fixture for ${slug}`).toBeTruthy();
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { plindberg: true });
      const tracked = hrefs.filter((href) => href.includes('do.p-lindberg.se'));
      expect(tracked.length).toBeGreaterThan(0);
      for (const href of tracked) {
        expect(href).toContain(`as=${ADTRACTION_SOURCE_ID}`);
        expect(href).toContain(`a=${PLINDBERG_AD_ID}`);
      }

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it.each(VETAPOTEK_REWRITE_SLUGS)(
    'rewrites every naked Vetapotek shop href on %s and keeps link text',
    (slug) => {
      const source = PAGE_FIXTURES[slug];
      expect(source, `missing fixture for ${slug}`).toBeTruthy();
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { vetapotek: true });
      const tracked = hrefs.filter((href) => href.includes('id.vetapotek.se'));
      expect(tracked.length).toBeGreaterThan(0);
      for (const href of tracked) {
        expect(href).toContain(`as=${ADTRACTION_SOURCE_ID}`);
        expect(href).toContain(`a=${VETAPOTEK_AD_ID}`);
      }

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it('does not wrap Granngården, FirstVet, Wexthuset, Outl1 or Bonden', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES['vad-ater-hons'], 'vad-ater-hons');
    expect(rewritten).toContain('href="https://www.bonden.se/"');
    expect(rewritten).toContain('href="https://www.wexthuset.com/"');
    expect(rewritten).toContain('href="https://firstvet.com/sv/butik"');
    expect(rewritten).toContain('href="https://www.vetzoo.se/"');
    expect(rewritten).not.toContain('outl1');
    expect(rewritten).not.toContain('granngarden');
  });

  it('leaves Granngården naked on pages that also have P-Lindberg', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES['bygga-honshus'], 'bygga-honshus');
    expect(rewritten).toContain('href="https://www.granngarden.se/"');
  });

  it('does not touch the köpguide slug even if a naked shop href were present', () => {
    const source = `${KOPGUIDE_FIXTURE} <a href="https://www.p-lindberg.se/">P-Lindberg</a>`;
    const rewritten = rewriteNakedShopAffiliateHrefs(source, 'honshus-2026-kompletta-kopguiden');
    expect(rewritten).toBe(source);
  });

  it('does not double-wrap already tracked köpguide links', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(KOPGUIDE_FIXTURE, 'bygga-honshus');
    expect(rewritten).toBe(KOPGUIDE_FIXTURE);
    expect(rewritten.match(/do\.p-lindberg\.se/g)?.length).toBe(1);
    expect(rewritten).not.toContain('do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://do.p-lindberg.se');
  });

  it.each(Object.keys(NO_STORE_FIXTURES))('does not add store links to %s', (slug) => {
    const source = NO_STORE_FIXTURES[slug];
    const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
    expect(rewritten).toBe(source);
    expect(extractHrefValues(rewritten)).toEqual([]);
  });

  it('is a no-op without a slug', () => {
    const source = '<a href="https://www.p-lindberg.se/">P-Lindberg</a>';
    expect(rewriteNakedShopAffiliateHrefs(source)).toBe(source);
  });

  it('rewrites markdown shop links the same way', () => {
    const md = 'Se [P-Lindberg](https://www.p-lindberg.se/) och [Vetapotek](https://vetapotek.se/)';
    const rewritten = rewriteNakedShopAffiliateHrefs(md, 'sittpinnar-hons');
    expect(rewritten).toContain(`https://do.p-lindberg.se/t/t?a=${PLINDBERG_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=https%3A%2F%2Fwww.p-lindberg.se%2F`);
    expect(rewritten).toContain(`https://id.vetapotek.se/t/t?a=${VETAPOTEK_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=https://vetapotek.se/`);
    expect(rewritten).toContain('[P-Lindberg]');
    expect(rewritten).toContain('[Vetapotek]');
  });
});
