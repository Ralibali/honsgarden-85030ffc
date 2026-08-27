import { describe, expect, it } from 'vitest';
import {
  ADTRACTION_SOURCE_ID,
  BONDEN_AD_ID,
  BONDEN_REWRITE_SLUGS,
  FIRSTVET_AD_ID,
  FIRSTVET_REWRITE_SLUGS,
  OUTL1_AD_ID,
  OUTL1_REWRITE_SLUGS,
  PLINDBERG_AD_ID,
  PLINDBERG_REWRITE_SLUGS,
  VETAPOTEK_AD_ID,
  VETAPOTEK_REWRITE_SLUGS,
  WEXTHUSET_AD_ID,
  WEXTHUSET_REWRITE_SLUGS,
  extractHrefValues,
  isNakedBondenShopHref,
  isNakedFirstVetShopHref,
  isNakedOutl1ShopHref,
  isNakedPLindbergShopHref,
  isNakedVetapotekShopHref,
  isNakedWexthusetShopHref,
  rewriteNakedShopAffiliateHrefs,
} from '@/lib/adtractionShopLinks';

/** Representative HTML taken from the live blog_posts content (hrefs + link text). */
const PAGE_FIXTURES: Record<string, string> = {
  'bygga-honshus':
    'stor vardagsvinst. <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Jämför hönsluckor hos P-Lindberg</a> och <a href="https://www.granngarden.se/">Granngården</a> <a href="https://www.bonden.se/">Bonden</a>',
  'klacka-agg':
    'Jämför gärna hos <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">P-Lindberg</a> och <a href="https://www.granngarden.se/">Granngården</a>',
  'vad-ater-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a></li><li><strong>Vitamintillskott</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a>, <a href="https://www.vetzoo.se/">Vetzoo</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://firstvet.com/sv/butik">FirstVet</a>',
  'kopa-hons':
    '<a href="https://www.granngarden.se/">Granngården</a> <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Se foderautomater hos P-Lindberg</a> <a href="https://www.bonden.se/">Bonden</a>',
  'vattenautomat-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a></li><li><strong>Äppelvinäger</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a> <a href="https://www.wexthuset.com/">Wexthuset</a>',
  'varmelampa-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://firstvet.com/sv/butik">FirstVet</a>',
  'varprede-hons':
    'kan du börja här: <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">jämför reden hos P-Lindberg</a> och <a href="https://www.bonden.se/">Bonden</a>',
  'sittpinnar-hons':
    '<a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a></li><li><strong>Hönshusinredning</strong> – <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://www.bonden.se/">Bonden</a>',
  'kalkben-hos-hons':
    '<a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a></li><li><strong>Insektsmedel</strong> – <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/" target="_blank">Wexthuset.com</a> <a href="https://firstvet.com/sv/butik">FirstVet</a> <a href="https://www.bonden.se/">Bonden</a>',
  'kvalster-hons':
    '<strong>Röd hönskvalstermedel</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a> <a href="https://firstvet.com/sv/butik">FirstVet</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://www.bonden.se/">Bonden</a>',
  'aggledarinflammation-hons':
    '<strong>Digital veterinärrådgivning</strong> – <a href="https://firstvet.com/sv/butik" target="_blank">FirstVet.com</a></li><li><strong>Djurhälsoprodukter</strong> – <a href="https://www.vetzoo.se/">VetZoo.se</a>, <a href="https://vetapotek.se/">Vetapotek.se</a>',
  'hur-manga-agg-lagger-en-hona':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a> <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a> <a href="https://www.wexthuset.com/" target="_blank">Wexthuset.com</a>',
  'brahma-hons':
    '<a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Se värpreden hos P-Lindberg</a> <a href="https://www.granngarden.se/" target="_blank" rel="nofollow sponsored">Jämför vattenautomater hos Granngården</a> <a href="https://www.bonden.se/" target="_blank" rel="nofollow sponsored">Se foderutrustning hos Bonden</a>',
  'hons-pa-vintern':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a> <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/" target="_blank">Wexthuset.com</a> <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a>',
  'skaffa-hons-nyborjare':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a> <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a> <a href="https://www.wexthuset.com/" target="_blank">Wexthuset.com</a> <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a> <a href="https://firstvet.com/sv/butik" target="_blank">FirstVet.com</a>',
  'fjaderplockning-hons':
    '<a href="https://www.granngarden.se/" target="_blank" rel="nofollow sponsored">Granngården</a> <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">P-Lindberg</a>',
  'ruggning-hons':
    '<a href="https://www.granngarden.se/" target="_blank" rel="nofollow sponsored">foder och tillskott hos Granngården</a> <a href="https://www.bonden.se/" target="_blank" rel="nofollow sponsored">fler produkter hos Bonden</a>',
  'paduan-hons':
    '<a href="https://www.bonden.se/" target="_blank" rel="nofollow sponsored">Bonden</a> <a href="https://www.granngarden.se/" target="_blank" rel="nofollow sponsored">Granngården</a>',
};

const KOPGUIDE_FIXTURE = [
  '<a href="https://do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Fwww.p-lindberg.se%2Fstartset-hoens-stort-9067619%2F">Se Startset</a>',
  '<a href="https://id.vetapotek.se/t/t?a=1701463577&amp;as=2056181186&amp;t=2&amp;tk=1&amp;cupa_sku=7330824007972&amp;url=https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/">Kiselgur tracked</a>',
  '<a href="https://outl1.se/honshus-med-utegard?var=12423">Lyfco</a>',
  '<a href="https://do.outl1.se/t/t?a=1728546061&amp;as=2056181186&amp;t=2&amp;tk=1&amp;cupa_sku=209-1-3&amp;url=https://outl1.se/honshus-med-utegard?var=12423">Lyfco tracked</a>',
  // Live leftover naked product hrefs on /blogg/honshus-2026-kompletta-kopguiden
  '<a href="https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/">Kiselgur 2 kg</a>',
  '<a href="https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-500-g-7330824007989/">500 g</a>',
].join(' ');

const NO_STORE_FIXTURES: Record<string, string> = {
  'bast-honsras-sverige': '<p>Hedemora och Orpington är härdiga raser.</p>',
  orpington: '<p>Orpington är en tung ras.</p>',
  'berakna-foderkostnad-for-hons': '<p>Räkna på säcken, inte på känsla.</p>',
};

function expectNoNakedShopHrefs(
  html: string,
  {
    plindberg = false,
    vetapotek = false,
    wexthuset = false,
    firstvet = false,
    outl1 = false,
    bonden = false,
  } = {},
) {
  const hrefs = extractHrefValues(html);
  if (plindberg) {
    expect(hrefs.filter(isNakedPLindbergShopHref), html).toEqual([]);
  }
  if (vetapotek) {
    expect(hrefs.filter(isNakedVetapotekShopHref), html).toEqual([]);
  }
  if (wexthuset) {
    expect(hrefs.filter(isNakedWexthusetShopHref), html).toEqual([]);
  }
  if (firstvet) {
    expect(hrefs.filter(isNakedFirstVetShopHref), html).toEqual([]);
  }
  if (outl1) {
    expect(hrefs.filter(isNakedOutl1ShopHref), html).toEqual([]);
  }
  if (bonden) {
    expect(hrefs.filter(isNakedBondenShopHref), html).toEqual([]);
  }
}

function expectTracked(hrefs: string[], host: string, adId: string) {
  const tracked = hrefs.filter((href) => href.includes(host));
  expect(tracked.length).toBeGreaterThan(0);
  for (const href of tracked) {
    expect(href).toContain(`as=${ADTRACTION_SOURCE_ID}`);
    expect(href).toContain(`a=${adId}`);
  }
  return tracked;
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

  it('matches Wexthuset owner prefix with encoded url=', () => {
    const html = rewriteNakedShopAffiliateHrefs(
      '<a href="https://www.wexthuset.com/">Wexthuset</a>',
      'vattenautomat-hons',
    );
    expect(html).toContain(
      `https://go.wexthuset.com/t/t?a=${WEXTHUSET_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Fwww.wexthuset.com%2F`,
    );
  });

  it('matches FirstVet owner prefix with encoded url=', () => {
    const html = rewriteNakedShopAffiliateHrefs(
      '<a href="https://firstvet.com/sv/butik">FirstVet</a>',
      'kvalster-hons',
    );
    expect(html).toContain(
      `https://do.shop.firstvet.com/t/t?a=${FIRSTVET_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Ffirstvet.com%2Fsv%2Fbutik`,
    );
  });

  it('matches existing Outl1 product-feed style (url= destination, not encoded)', () => {
    const html = rewriteNakedShopAffiliateHrefs(
      '<a href="https://outl1.se/honshus-med-utegard?var=12423">Lyfco</a>',
      'honshus-2026-kompletta-kopguiden',
    );
    expect(html).toContain(
      `https://do.outl1.se/t/t?a=${OUTL1_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https://outl1.se/honshus-med-utegard?var=12423`,
    );
  });

  it('matches existing Bonden product-feed style (url= destination, not encoded)', () => {
    const www = rewriteNakedShopAffiliateHrefs(
      '<a href="https://www.bonden.se/">Bonden.se</a>',
      'vad-ater-hons',
    );
    expect(www).toContain(
      `https://pin.bonden.se/t/t?a=${BONDEN_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https://www.bonden.se/`,
    );

    const apex = rewriteNakedShopAffiliateHrefs(
      '<a href="https://bonden.se/vaermeplatta/">Bonden</a>',
      'bygga-honshus',
    );
    expect(apex).toContain(
      `https://pin.bonden.se/t/t?a=${BONDEN_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https://bonden.se/vaermeplatta/`,
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
      expectTracked(hrefs, 'do.p-lindberg.se', PLINDBERG_AD_ID);

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it.each(VETAPOTEK_REWRITE_SLUGS.filter((slug) => slug !== 'honshus-2026-kompletta-kopguiden'))(
    'rewrites every naked Vetapotek shop href on %s and keeps link text',
    (slug) => {
      const source = PAGE_FIXTURES[slug];
      expect(source, `missing fixture for ${slug}`).toBeTruthy();
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { vetapotek: true });
      expectTracked(hrefs, 'id.vetapotek.se', VETAPOTEK_AD_ID);

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it.each(WEXTHUSET_REWRITE_SLUGS)(
    'rewrites every naked Wexthuset shop href on %s and keeps link text',
    (slug) => {
      const source = PAGE_FIXTURES[slug];
      expect(source, `missing fixture for ${slug}`).toBeTruthy();
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { wexthuset: true });
      expectTracked(hrefs, 'go.wexthuset.com', WEXTHUSET_AD_ID);

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it.each(FIRSTVET_REWRITE_SLUGS)(
    'rewrites every naked FirstVet shop href on %s and keeps link text',
    (slug) => {
      const source = PAGE_FIXTURES[slug];
      expect(source, `missing fixture for ${slug}`).toBeTruthy();
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { firstvet: true });
      expectTracked(hrefs, 'do.shop.firstvet.com', FIRSTVET_AD_ID);

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it.each(BONDEN_REWRITE_SLUGS)(
    'rewrites every naked Bonden shop href on %s and keeps link text',
    (slug) => {
      const source = PAGE_FIXTURES[slug];
      expect(source, `missing fixture for ${slug}`).toBeTruthy();
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { bonden: true });
      expectTracked(hrefs, 'pin.bonden.se', BONDEN_AD_ID);

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it.each(OUTL1_REWRITE_SLUGS)(
    'rewrites every naked Outl1 shop href on %s and keeps link text',
    (slug) => {
      const source = KOPGUIDE_FIXTURE;
      const rewritten = rewriteNakedShopAffiliateHrefs(source, slug);
      const hrefs = extractHrefValues(rewritten);

      expectNoNakedShopHrefs(rewritten, { outl1: true });
      const tracked = hrefs.filter((href) => href.includes('do.outl1.se'));
      expect(tracked.length).toBeGreaterThan(0);
      for (const href of tracked) {
        expect(href).toContain(`as=${ADTRACTION_SOURCE_ID}`);
      }
      // Text-link wrap uses owner `a=`; already-tracked product card keeps feed `a=`.
      expect(tracked.some((href) => href.includes(`a=${OUTL1_AD_ID}`) && !href.includes('cupa_sku'))).toBe(true);
      expect(tracked.some((href) => href.includes('a=1728546061') && href.includes('cupa_sku'))).toBe(true);

      const originalText = source.replace(/<[^>]+>/g, '');
      const rewrittenText = rewritten.replace(/<[^>]+>/g, '');
      expect(rewrittenText).toBe(originalText);
    },
  );

  it('does not wrap Granngården or Vetzoo (no program a=)', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES['vad-ater-hons'], 'vad-ater-hons');
    expect(rewritten).toContain('href="https://www.vetzoo.se/"');
    expect(rewritten).not.toContain('href="https://www.bonden.se/"');
    expect(rewritten).toContain('pin.bonden.se');
    expect(rewritten).not.toContain('outl1');
    expect(rewritten).not.toContain('granngarden');
  });

  it('leaves Granngården naked on pages that also have P-Lindberg and Bonden', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES['bygga-honshus'], 'bygga-honshus');
    expect(rewritten).toContain('href="https://www.granngarden.se/"');
    expect(rewritten).toContain('pin.bonden.se');
    expect(rewritten).toContain('do.p-lindberg.se');
  });

  it('does not wrap P-Lindberg on the köpguide slug; wraps remaining naked Vetapotek 2 kg + 500 g', () => {
    const source = `${KOPGUIDE_FIXTURE} <a href="https://www.p-lindberg.se/">P-Lindberg</a>`;
    const rewritten = rewriteNakedShopAffiliateHrefs(source, 'honshus-2026-kompletta-kopguiden');
    expect(rewritten).toContain('href="https://www.p-lindberg.se/"');
    expect(rewritten).not.toContain(
      'href="https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/"',
    );
    expect(rewritten).not.toContain(
      'href="https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-500-g-7330824007989/"',
    );
    expect(rewritten).toContain(
      `https://id.vetapotek.se/t/t?a=${VETAPOTEK_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/`,
    );
    expect(rewritten).toContain(
      `https://id.vetapotek.se/t/t?a=${VETAPOTEK_AD_ID}&amp;as=${ADTRACTION_SOURCE_ID}&amp;t=2&amp;tk=1&amp;url=https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-500-g-7330824007989/`,
    );
    expect(rewritten).toContain('do.p-lindberg.se/t/t?a=1954027467');
    // Already-tracked feed card keeps its own a= and is not double-wrapped.
    expect(rewritten).toContain('id.vetapotek.se/t/t?a=1701463577');
    expect(rewritten).not.toContain('id.vetapotek.se/t/t?a=1701463575&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://id.vetapotek.se');
  });

  it('does not wrap Outl1 on slugs other than the köpguide', () => {
    const source = '<a href="https://outl1.se/honshus-med-utegard?var=12423">Lyfco</a>';
    const rewritten = rewriteNakedShopAffiliateHrefs(source, 'bygga-honshus');
    expect(rewritten).toBe(source);
  });

  it('does not wrap Bonden on slugs that have no existing Bonden href allowlist entry', () => {
    const source = '<a href="https://www.bonden.se/">Bonden</a>';
    expect(rewriteNakedShopAffiliateHrefs(source, 'klacka-agg')).toBe(source);
    expect(rewriteNakedShopAffiliateHrefs(source, 'fjaderplockning-hons')).toBe(source);
  });

  it('does not double-wrap already tracked köpguide / Outl1 / Bonden hosts', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(KOPGUIDE_FIXTURE, 'bygga-honshus');
    expect(rewritten).toBe(KOPGUIDE_FIXTURE);
    expect(rewritten.match(/do\.p-lindberg\.se/g)?.length).toBe(1);
    expect(rewritten).not.toContain('do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://do.p-lindberg.se');

    const onKopguide = rewriteNakedShopAffiliateHrefs(KOPGUIDE_FIXTURE, 'honshus-2026-kompletta-kopguiden');
    expect(onKopguide).toContain('do.outl1.se/t/t?a=1728546061&amp;as=2056181186&amp;t=2&amp;tk=1&amp;cupa_sku=209-1-3&amp;url=https://outl1.se/honshus-med-utegard?var=12423');
    expect(onKopguide).not.toContain('do.outl1.se/t/t?a=1728546059&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://do.outl1.se');

    const alreadyTracked = [
      '<a href="https://pin.bonden.se/t/t?a=1960530621&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://www.bonden.se/">Bonden</a>',
      '<a href="https://do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Fwww.p-lindberg.se%2F">P-Lindberg</a>',
      '<a href="https://id.vetapotek.se/t/t?a=1701463575&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://vetapotek.se/">Vetapotek</a>',
      '<a href="https://go.wexthuset.com/t/t?a=1577762835&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Fwww.wexthuset.com%2F">Wexthuset</a>',
      '<a href="https://do.shop.firstvet.com/t/t?a=1615741779&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https%3A%2F%2Ffirstvet.com%2Fsv%2Fbutik">FirstVet</a>',
    ].join(' ');
    expect(rewriteNakedShopAffiliateHrefs(alreadyTracked, 'skaffa-hons-nyborjare')).toBe(alreadyTracked);
    expect(rewriteNakedShopAffiliateHrefs(alreadyTracked, 'vad-ater-hons')).toBe(alreadyTracked);
  });

  it('does not add FirstVet or Wexthuset to pages that do not already have those hrefs', () => {
    const rewritten = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES['bygga-honshus'], 'bygga-honshus');
    expect(rewritten).not.toContain('wexthuset');
    expect(rewritten).not.toContain('firstvet');
    expect(rewritten).not.toContain('outl1');
  });

  it('does not wrap FirstVet on Wexthuset-only slugs or Wexthuset on FirstVet-only slugs', () => {
    const vatten = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES['vattenautomat-hons'], 'vattenautomat-hons');
    expect(vatten).not.toContain('firstvet');
    expect(vatten).toContain('go.wexthuset.com');

    const aggledar = rewriteNakedShopAffiliateHrefs(
      PAGE_FIXTURES['aggledarinflammation-hons'],
      'aggledarinflammation-hons',
    );
    expect(aggledar).not.toContain('wexthuset');
    expect(aggledar).toContain('do.shop.firstvet.com');
    expect(aggledar).not.toContain('href="https://vetapotek.se/"');
    expect(aggledar).toContain('id.vetapotek.se');
    expect(aggledar).toContain('href="https://www.vetzoo.se/"');
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
    const md = 'Se [P-Lindberg](https://www.p-lindberg.se/), [Vetapotek](https://vetapotek.se/) och [Bonden](https://www.bonden.se/)';
    const rewritten = rewriteNakedShopAffiliateHrefs(md, 'sittpinnar-hons');
    expect(rewritten).toContain(`https://do.p-lindberg.se/t/t?a=${PLINDBERG_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=https%3A%2F%2Fwww.p-lindberg.se%2F`);
    expect(rewritten).toContain(`https://id.vetapotek.se/t/t?a=${VETAPOTEK_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=https://vetapotek.se/`);
    expect(rewritten).toContain(`https://pin.bonden.se/t/t?a=${BONDEN_AD_ID}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=https://www.bonden.se/`);
    expect(rewritten).toContain('[P-Lindberg]');
    expect(rewritten).toContain('[Vetapotek]');
    expect(rewritten).toContain('[Bonden]');
  });
});
