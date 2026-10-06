/**
 * Wraps naked shop hrefs with the Adtraction tracking prefix already used
 * on /blogg/honshus-2026-kompletta-kopguiden (and owner / in-repo program IDs).
 *
 * Granngården and Vetzoo stay naked — wrap BLOCKED (no real program `a=` /
 * tracking host after repo + PR 25/26/34 lookup). Do not invent IDs.
 * Pure shop programs (`sitewide: true`) apply to every article; reviewed
 * editorial guides pass `{ sitewide: false }`. Tracked anchors get
 * `rel="sponsored noopener"`.
 * Program IDs and tracking hosts live in `adtractionPrograms.mjs`.
 * Keep in sync with `src/lib/adtractionShopLinks.ts` (React app + tests).
 */

import { SHOP_PROGRAMS as PROGRAMS, unescapeHref, wrapShopDestination } from './adtractionPrograms.mjs';

export * from './adtractionPrograms.mjs';

const ANCHOR_OPEN_RE = /<a\b[^>]*>/gi;
const HREF_ATTR_RE = /\shref=(["'])([^"']+)\1/i;
const REL_ATTR_RE = /\srel=(["'])([^"']*)\1/i;
const MARKDOWN_LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/gi;

function parseAbsoluteUrl(href) {
  try {
    return new URL(unescapeHref(href));
  } catch {
    return null;
  }
}

function programForSlugAndHost(slug, hostname, sitewide) {
  for (const program of PROGRAMS) {
    if (!program.isNakedHost(hostname)) continue;
    if (program.slugs.includes(slug) || (sitewide && program.sitewide)) return program;
  }
  return null;
}

export function shopMerchantFromHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return null;
  const hostname = parsed.hostname.toLowerCase();
  const program = PROGRAMS.find((item) => item.trackingHost === hostname || item.isNakedHost(hostname));
  return program?.merchant ?? null;
}

function isTrackedShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const hostname = parsed.hostname.toLowerCase();
  return PROGRAMS.some((program) => program.trackingHost === hostname);
}

function withSponsoredRel(anchorOpenTag) {
  const relMatch = anchorOpenTag.match(REL_ATTR_RE);
  if (!relMatch) return anchorOpenTag.replace(/^<a\b/i, '<a rel="sponsored noopener"');
  const tokens = relMatch[2].split(/\s+/).filter(Boolean).map((token) => token.toLowerCase());
  if (tokens.includes('sponsored') && tokens.includes('noopener')) return anchorOpenTag;
  const next = [...new Set([...tokens, 'sponsored', 'noopener'])].join(' ');
  return anchorOpenTag.replace(REL_ATTR_RE, ` rel=${relMatch[1]}${next}${relMatch[1]}`);
}

function trackedShopUrl(href, slug, sitewide) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return null;
  const program = programForSlugAndHost(slug, parsed.hostname.toLowerCase(), sitewide);
  return program ? wrapShopDestination(parsed.toString(), program) : null;
}

export function rewriteNakedShopAffiliateHrefs(content, slug, { sitewide = true } = {}) {
  if (!slug || !content) return content;

  let out = content.replace(ANCHOR_OPEN_RE, (tag) => {
    const hrefMatch = tag.match(HREF_ATTR_RE);
    if (!hrefMatch) return tag;
    const [, quote, href] = hrefMatch;
    const tracked = trackedShopUrl(href, slug, sitewide);
    if (tracked) {
      const replaced = tag.replace(HREF_ATTR_RE, ` href=${quote}${tracked.replace(/&/g, '&amp;')}${quote}`);
      return withSponsoredRel(replaced);
    }
    return isTrackedShopHref(href) ? withSponsoredRel(tag) : tag;
  });

  out = out.replace(MARKDOWN_LINK_RE, (full, url) => {
    const tracked = trackedShopUrl(url, slug, sitewide);
    return tracked ? `](${tracked})` : full;
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

export function isNakedWexthusetShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.wexthuset.com' || host === 'wexthuset.com';
}

export function isNakedFirstVetShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.firstvet.com' || host === 'firstvet.com';
}

export function isNakedOutl1ShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.outl1.se' || host === 'outl1.se';
}

export function isNakedBondenShopHref(href) {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.bonden.se' || host === 'bonden.se';
}
