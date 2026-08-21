/**
 * Wraps naked P-Lindberg / Vetapotek shop hrefs with the Adtraction tracking
 * prefix already used on /blogg/honshus-2026-kompletta-kopguiden.
 *
 * Only rewrites existing hrefs on an explicit slug allowlist. Does not add
 * links, CTAs, or new merchants (Granngården, FirstVet, Wexthuset, Outl1).
 *
 * Keep in sync with `src/lib/adtractionShopLinks.mjs` (prerender).
 */

export const ADTRACTION_SOURCE_ID = '2056181186';

/** Channel `a=` from the köpguide's tracked P-Lindberg links. */
export const PLINDBERG_AD_ID = '1954027467';

/** Channel `a=` provided by the program owner for Vetapotek text links. */
export const VETAPOTEK_AD_ID = '1701463575';

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
] as const;

export const VETAPOTEK_REWRITE_SLUGS = [
  'vattenautomat-hons',
  'vad-ater-hons',
  'sittpinnar-hons',
  'kalkben-hos-hons',
  'kvalster-hons',
] as const;

type ShopProgram = {
  slugs: readonly string[];
  trackingHost: string;
  adId: string;
  /** True when the köpguide / existing Adtraction style percent-encodes `url=`. */
  encodeDestination: boolean;
  isNakedHost: (hostname: string) => boolean;
};

const PROGRAMS: ShopProgram[] = [
  {
    slugs: PLINDBERG_REWRITE_SLUGS,
    trackingHost: 'do.p-lindberg.se',
    adId: PLINDBERG_AD_ID,
    encodeDestination: true,
    isNakedHost: (hostname) => hostname === 'www.p-lindberg.se' || hostname === 'p-lindberg.se',
  },
  {
    slugs: VETAPOTEK_REWRITE_SLUGS,
    trackingHost: 'id.vetapotek.se',
    adId: VETAPOTEK_AD_ID,
    // Existing köpguide / product-feed Vetapotek links pass `url=` unencoded.
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.vetapotek.se' || hostname === 'vetapotek.se',
  },
];

const HTML_HREF_RE = /href=(["'])([^"']+)\1/gi;
const MARKDOWN_LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/gi;

function unescapeHref(href: string): string {
  return href.replace(/&amp;/g, '&').trim();
}

function parseAbsoluteUrl(href: string): URL | null {
  try {
    return new URL(unescapeHref(href));
  } catch {
    return null;
  }
}

function programForSlugAndHost(slug: string, hostname: string): ShopProgram | null {
  for (const program of PROGRAMS) {
    if (!program.slugs.includes(slug)) continue;
    if (program.isNakedHost(hostname)) return program;
  }
  return null;
}

/** Build an Adtraction click URL matching the köpguide / existing merchant style. */
export function wrapShopDestination(destination: string, program: ShopProgram): string {
  const dest = unescapeHref(destination);
  const urlParam = program.encodeDestination ? encodeURIComponent(dest) : dest;
  return `https://${program.trackingHost}/t/t?a=${program.adId}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${urlParam}`;
}

function rewriteIfNakedShopUrl(href: string, slug: string | undefined, htmlAttribute: boolean): string {
  if (!slug) return href;
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return href;
  const program = programForSlugAndHost(slug, parsed.hostname.toLowerCase());
  if (!program) return href;
  const tracked = wrapShopDestination(parsed.toString(), program);
  return htmlAttribute ? tracked.replace(/&/g, '&amp;') : tracked;
}

/**
 * Rewrite naked P-Lindberg / Vetapotek shop hrefs on allowlisted slugs.
 * Already-tracked `do.p-lindberg.se` / `id.vetapotek.se` links are left alone.
 */
export function rewriteNakedShopAffiliateHrefs(content: string, slug?: string): string {
  if (!slug || !content) return content;

  let out = content.replace(HTML_HREF_RE, (full, quote: string, href: string) => {
    const next = rewriteIfNakedShopUrl(href, slug, true);
    return next === href ? full : `href=${quote}${next}${quote}`;
  });

  out = out.replace(MARKDOWN_LINK_RE, (full, url: string) => {
    const next = rewriteIfNakedShopUrl(url, slug, false);
    return next === url ? full : `](${next})`;
  });

  return out;
}

export function extractHrefValues(content: string): string[] {
  const hrefs: string[] = [];
  const re = /href=(["'])([^"']+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    hrefs.push(unescapeHref(match[2]));
  }
  const md = /\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((match = md.exec(content)) !== null) {
    hrefs.push(unescapeHref(match[1]));
  }
  return hrefs;
}

export function isNakedPLindbergShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.p-lindberg.se' || host === 'p-lindberg.se';
}

export function isNakedVetapotekShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.vetapotek.se' || host === 'vetapotek.se';
}
