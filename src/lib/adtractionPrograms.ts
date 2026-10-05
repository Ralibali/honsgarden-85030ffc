/**
 * Adtraction programs approved for the Hönsgården channel (source
 * `2056181186`) and the tracking-link format each merchant uses.
 *
 * Kept separate from the article link rewriting in `adtractionShopLinks.ts`
 * so the homepage bundle only carries what contextual shop CTAs need.
 * Keep in sync with `src/lib/adtractionPrograms.mjs` (prerender).
 */

export const ADTRACTION_SOURCE_ID = '2056181186';

/** Channel `a=` from the köpguide's tracked P-Lindberg links. */
export const PLINDBERG_AD_ID = '1954027467';

/** Channel `a=` provided by the program owner for Vetapotek text links. */
export const VETAPOTEK_AD_ID = '1701463575';

/** Channel `a=` provided by the program owner for Wexthuset text links. */
export const WEXTHUSET_AD_ID = '1577762835';

/** Channel `a=` provided by the program owner for FirstVet text links. */
export const FIRSTVET_AD_ID = '1615741779';

/** Channel `a=` provided by the program owner for Outl1 text links. */
export const OUTL1_AD_ID = '1728546059';

/**
 * Bonden deeplink / product-feed `a=` already used in-repo with `url=`
 * (`affiliateProducts.ts`). Banner-only IDs (1960530789 / 0731 / 0630) have no `url=`.
 */
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
] as const;

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
] as const;

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
] as const;

export const FIRSTVET_REWRITE_SLUGS = [
  'varmelampa-hons',
  'kvalster-hons',
  'kalkben-hos-hons',
  'vad-ater-hons',
  'aggledarinflammation-hons',
  'skaffa-hons-nyborjare',
] as const;

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
] as const;

export const OUTL1_REWRITE_SLUGS = ['honshus-2026-kompletta-kopguiden'] as const;

export type ShopMerchant = 'p-lindberg' | 'vetapotek' | 'wexthuset' | 'firstvet' | 'outl1' | 'bonden';

export type ShopProgram = {
  merchant: ShopMerchant;
  slugs: readonly string[];
  /** Wrap naked links to this shop on every non-reviewed article, not only `slugs`. */
  sitewide: boolean;
  trackingHost: string;
  adId: string;
  /** True when the köpguide / existing Adtraction style percent-encodes `url=`. */
  encodeDestination: boolean;
  isNakedHost: (hostname: string) => boolean;
};

export const SHOP_PROGRAMS: readonly ShopProgram[] = [
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
    // Existing köpguide / product-feed Vetapotek links pass `url=` unencoded.
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.vetapotek.se' || hostname === 'vetapotek.se',
  },
  {
    merchant: 'wexthuset',
    slugs: WEXTHUSET_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'go.wexthuset.com',
    adId: WEXTHUSET_AD_ID,
    // Same encoded `url=` style as köpguide P-Lindberg text links.
    encodeDestination: true,
    isNakedHost: (hostname) => hostname === 'www.wexthuset.com' || hostname === 'wexthuset.com',
  },
  {
    merchant: 'firstvet',
    slugs: FIRSTVET_REWRITE_SLUGS,
    sitewide: false,
    trackingHost: 'do.shop.firstvet.com',
    adId: FIRSTVET_AD_ID,
    // Same encoded `url=` style as köpguide P-Lindberg text links.
    encodeDestination: true,
    isNakedHost: (hostname) => hostname === 'www.firstvet.com' || hostname === 'firstvet.com',
  },
  {
    merchant: 'outl1',
    slugs: OUTL1_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'do.outl1.se',
    adId: OUTL1_AD_ID,
    // Existing Outl1 product-feed / owner links pass `url=` unencoded (`?var=`).
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.outl1.se' || hostname === 'outl1.se',
  },
  {
    merchant: 'bonden',
    slugs: BONDEN_REWRITE_SLUGS,
    sitewide: true,
    trackingHost: 'pin.bonden.se',
    adId: BONDEN_AD_ID,
    // Existing Bonden product-feed links pass `url=` unencoded.
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.bonden.se' || hostname === 'bonden.se',
  },
];

export function unescapeHref(href: string): string {
  return href.replace(/&amp;/g, '&').trim();
}

/** Build an Adtraction click URL matching the köpguide / existing merchant style. */
export function wrapShopDestination(destination: string, program: ShopProgram): string {
  const dest = unescapeHref(destination);
  const urlParam = program.encodeDestination ? encodeURIComponent(dest) : dest;
  return `https://${program.trackingHost}/t/t?a=${program.adId}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${urlParam}`;
}

/** Packet 1 merchants with a real owner `a=` + tracking host. Token absent — host/a= only. */
export type PacketShopMerchant = 'outl1' | 'p-lindberg' | 'bonden';

const PACKET_PROGRAM_BY_MERCHANT: Record<PacketShopMerchant, ShopProgram> = {
  'p-lindberg': SHOP_PROGRAMS.find((program) => program.adId === PLINDBERG_AD_ID)!,
  outl1: SHOP_PROGRAMS.find((program) => program.adId === OUTL1_AD_ID)!,
  bonden: SHOP_PROGRAMS.find((program) => program.adId === BONDEN_AD_ID)!,
};

/** Same wrap as existing Adtraction text links. Does not invent `a=` IDs. */
export function buildTrackedShopHref(merchant: PacketShopMerchant, destination: string): string {
  return wrapShopDestination(destination, PACKET_PROGRAM_BY_MERCHANT[merchant]);
}
