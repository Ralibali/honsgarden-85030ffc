/**
 * Adtraction programs approved for the Hönsgården channel and their
 * tracking-link format. Prerender copy of `src/lib/adtractionPrograms.ts`.
 *
 * Kept apart from the link rewriting in `adtractionShopLinks.mjs` because
 * `contextualShopPlacements.mjs` is also bundled into the app entry chunk.
 */

export const ADTRACTION_SOURCE_ID = '2056181186';
export const PLINDBERG_AD_ID = '1954027467';
export const VETAPOTEK_AD_ID = '1701463575';
export const WEXTHUSET_AD_ID = '1577762835';
export const FIRSTVET_AD_ID = '1615741779';
export const OUTL1_AD_ID = '1728546059';
export const BONDEN_AD_ID = '1960530621';

export const PLINDBERG_REWRITE_SLUGS = [
  'bygga-honshus',
  'klacka-agg',
  'vad-ater-hons',
  'kopa-hons',
  'vattenautomat-hons',
  'varmelampa-hons',
  'varprede-hons',
  'sittpinnar-hons',
  'kalkben-hos-hons',
  'hur-manga-agg-lagger-en-hona',
  'brahma-hons',
  'hons-pa-vintern',
  'skaffa-hons-nyborjare',
  'fjaderplockning-hons',
];

export const VETAPOTEK_REWRITE_SLUGS = [
  'vattenautomat-hons',
  'vad-ater-hons',
  'sittpinnar-hons',
  'kalkben-hos-hons',
  'kvalster-hons',
  'honshus-2026-kompletta-kopguiden',
  'aggledarinflammation-hons',
  'hur-manga-agg-lagger-en-hona',
  'hons-pa-vintern',
  'skaffa-hons-nyborjare',
];

export const WEXTHUSET_REWRITE_SLUGS = [
  'vattenautomat-hons',
  'varmelampa-hons',
  'sittpinnar-hons',
  'kvalster-hons',
  'kalkben-hos-hons',
  'vad-ater-hons',
  'hur-manga-agg-lagger-en-hona',
  'hons-pa-vintern',
  'skaffa-hons-nyborjare',
];

export const FIRSTVET_REWRITE_SLUGS = [
  'varmelampa-hons',
  'kvalster-hons',
  'kalkben-hos-hons',
  'vad-ater-hons',
  'aggledarinflammation-hons',
  'skaffa-hons-nyborjare',
];

export const BONDEN_REWRITE_SLUGS = [
  'bygga-honshus',
  'vad-ater-hons',
  'kopa-hons',
  'vattenautomat-hons',
  'varmelampa-hons',
  'varprede-hons',
  'sittpinnar-hons',
  'kalkben-hos-hons',
  'kvalster-hons',
  'hur-manga-agg-lagger-en-hona',
  'brahma-hons',
  'hons-pa-vintern',
  'skaffa-hons-nyborjare',
  'ruggning-hons',
  'paduan-hons',
];

export const OUTL1_REWRITE_SLUGS = ['honshus-2026-kompletta-kopguiden'];

export const SHOP_PROGRAMS = [
  {
    merchant: 'p-lindberg',
    slugs: PLINDBERG_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'do.p-lindberg.se',
    adId: PLINDBERG_AD_ID,
    encodeDestination: true,
    isNakedHost: (hostname) => hostname === 'www.p-lindberg.se' || hostname === 'p-lindberg.se',
  },
  {
    merchant: 'vetapotek',
    slugs: VETAPOTEK_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'id.vetapotek.se',
    adId: VETAPOTEK_AD_ID,
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.vetapotek.se' || hostname === 'vetapotek.se',
  },
  {
    merchant: 'wexthuset',
    slugs: WEXTHUSET_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'go.wexthuset.com',
    adId: WEXTHUSET_AD_ID,
    encodeDestination: true,
    isNakedHost: (hostname) => hostname === 'www.wexthuset.com' || hostname === 'wexthuset.com',
  },
  {
    merchant: 'firstvet',
    slugs: FIRSTVET_REWRITE_SLUGS,
    sitewide: false,
    trackingHost: 'do.shop.firstvet.com',
    adId: FIRSTVET_AD_ID,
    encodeDestination: true,
    isNakedHost: (hostname) => hostname === 'www.firstvet.com' || hostname === 'firstvet.com',
  },
  {
    merchant: 'outl1',
    slugs: OUTL1_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'do.outl1.se',
    adId: OUTL1_AD_ID,
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.outl1.se' || hostname === 'outl1.se',
  },
  {
    merchant: 'bonden',
    slugs: BONDEN_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'pin.bonden.se',
    adId: BONDEN_AD_ID,
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.bonden.se' || hostname === 'bonden.se',
  },
];

export function unescapeHref(href) {
  return href.replace(/&amp;/g, '&').trim();
}

export function wrapShopDestination(destination, program) {
  const dest = unescapeHref(destination);
  const urlParam = program.encodeDestination ? encodeURIComponent(dest) : dest;
  return `https://${program.trackingHost}/t/t?a=${program.adId}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${urlParam}`;
}

const PACKET_PROGRAM_BY_MERCHANT = {
  'p-lindberg': SHOP_PROGRAMS.find((program) => program.adId === PLINDBERG_AD_ID),
  outl1: SHOP_PROGRAMS.find((program) => program.adId === OUTL1_AD_ID),
  bonden: SHOP_PROGRAMS.find((program) => program.adId === BONDEN_AD_ID),
};

export function buildTrackedShopHref(merchant, destination) {
  return wrapShopDestination(destination, PACKET_PROGRAM_BY_MERCHANT[merchant]);
}
