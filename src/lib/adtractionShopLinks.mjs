/**
 * Wraps naked P-Lindberg / Vetapotek shop hrefs with the Adtraction tracking
 * prefix already used on /blogg/honshus-2026-kompletta-kopguiden.
 *
 * Keep in sync with `src/lib/adtractionShopLinks.ts` (React app + tests).
 */

export const ADTRACTION_SOURCE_ID = '2056181186';
export const PLINDBERG_AD_ID = '1954027467';
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
];

export const VETAPOTEK_REWRITE_SLUGS = [
  'vattenautomat-hons',
  'vad-ater-hons',
  'sittpinnar-hons',
  'kalkben-hos-hons',
  'kvalster-hons',
];

const PROGRAMS = [
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
    encodeDestination: false,
    isNakedHost: (hostname) => hostname === 'www.vetapotek.se' || hostname === 'vetapotek.se',
  },
];

const HTML_HREF_RE = /href=(["'])([^"']+)\1/gi;
const MARKDOWN_LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/gi;

function unescapeHref(href) {
  return href.replace(/&amp;/g, '&').trim();
}

function parseAbsoluteUrl(href) {
  try {
    return new URL(unescapeHref(href));
  } catch {
    return null;
  }
}

function programForSlugAndHost(slug, hostname) {
  for (const program of PROGRAMS) {
    if (!program.slugs.includes(slug)) continue;
    if (program.isNakedHost(hostname)) return program;
  }
  return null;
}

export function wrapShopDestination(destination, program) {
  const dest = unescapeHref(destination);
  const urlParam = program.encodeDestination ? encodeURIComponent(dest) : dest;
  return `https://${program.trackingHost}/t/t?a=${program.adId}&as=${ADTRACTION_SOURCE_ID}&t=2&tk=1&url=${urlParam}`;
}

function rewriteIfNakedShopUrl(href, slug, htmlAttribute) {
  if (!slug) return href;
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return href;
  const program = programForSlugAndHost(slug, parsed.hostname.toLowerCase());
  if (!program) return href;
  const tracked = wrapShopDestination(parsed.toString(), program);
  return htmlAttribute ? tracked.replace(/&/g, '&amp;') : tracked;
}

export function rewriteNakedShopAffiliateHrefs(content, slug) {
  if (!slug || !content) return content;

  let out = content.replace(HTML_HREF_RE, (full, quote, href) => {
    const next = rewriteIfNakedShopUrl(href, slug, true);
    return next === href ? full : `href=${quote}${next}${quote}`;
  });

  out = out.replace(MARKDOWN_LINK_RE, (full, url) => {
    const next = rewriteIfNakedShopUrl(url, slug, false);
    return next === url ? full : `](${next})`;
  });

  return out;
}

export function extractHrefValues(content) {
  const hrefs = [];
  const re = /href=(["'])([^"']+)\1/gi;
  let match;
  while ((match = re.exec(content)) !== null) {
    hrefs.push(unescapeHref(match[2]));
  }
  const md = /\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((match = md.exec(content)) !== null) {
    hrefs.push(unescapeHref(match[1]));
  }
  return hrefs;
}

export function isNakedPLindbergShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.p-lindberg.se' || host === 'p-lindberg.se';
}

export function isNakedVetapotekShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.vetapotek.se' || host === 'vetapotek.se';
}
