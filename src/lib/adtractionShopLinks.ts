/**
 * Wraps naked shop hrefs with the Adtraction tracking prefix already used
 * on /blogg/honshus-2026-kompletta-kopguiden (and owner / in-repo program IDs).
 *
 * Only rewrites hrefs that already exist in the article. Does not add links,
 * CTAs, or new merchants. Pure shop programs (`sitewide: true`) apply to every
 * article; reviewed editorial guides pass `{ sitewide: false }` so only the
 * explicit slug allowlists apply there. FirstVet stays allowlist-only because
 * firstvet.com also hosts advice pages that articles may cite as sources.
 *
 * Every wrapped or already-tracked anchor gets `rel="sponsored noopener"`.
 *
 * Left naked on purpose — wrap BLOCKED until a real merchant `a=` + tracking
 * host exist. Lookup (repo comments, this helper, PR 25/26/34): none for
 * Granngården or Vetzoo. `id.granngarden.se` is Microsoft login, not Adtraction.
 * VetZoo advertiser `1139817003` is not the channel `a=`. Do not invent IDs.
 *
 * Program IDs and tracking hosts live in `adtractionPrograms.ts`.
 * Keep in sync with `src/lib/adtractionShopLinks.mjs` (prerender).
 */

import {
  SHOP_PROGRAMS as PROGRAMS,
  unescapeHref,
  wrapShopDestination,
  type ShopMerchant,
  type ShopProgram,
} from './adtractionPrograms';

export * from './adtractionPrograms';

const ANCHOR_OPEN_RE = /<a\b[^>]*>/gi;
const HREF_ATTR_RE = /\shref=(["'])([^"']+)\1/i;
const REL_ATTR_RE = /\srel=(["'])([^"']*)\1/i;
const MARKDOWN_LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/gi;

export type ShopRewriteOptions = {
  /** False on reviewed editorial guides: only the explicit slug allowlists apply. */
  sitewide?: boolean;
};

function parseAbsoluteUrl(href: string): URL | null {
  try {
    return new URL(unescapeHref(href));
  } catch {
    return null;
  }
}

function programForSlugAndHost(slug: string, hostname: string, sitewide: boolean): ShopProgram | null {
  for (const program of PROGRAMS) {
    if (!program.isNakedHost(hostname)) continue;
    if (program.slugs.includes(slug) || (sitewide && program.sitewide)) return program;
  }
  return null;
}

/** Merchant for a naked shop URL or one of our Adtraction tracking hosts. */
export function shopMerchantFromHref(href: string): ShopMerchant | null {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return null;
  const hostname = parsed.hostname.toLowerCase();
  const program = PROGRAMS.find((item) => item.trackingHost === hostname || item.isNakedHost(hostname));
  return program?.merchant ?? null;
}

function isTrackedShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const hostname = parsed.hostname.toLowerCase();
  return PROGRAMS.some((program) => program.trackingHost === hostname);
}

/** Paid links must be marked for search engines (Google link-spam policy). */
function withSponsoredRel(anchorOpenTag: string): string {
  const relMatch = anchorOpenTag.match(REL_ATTR_RE);
  if (!relMatch) return anchorOpenTag.replace(/^<a\b/i, '<a rel="sponsored noopener"');
  const tokens = relMatch[2].split(/\s+/).filter(Boolean).map((token) => token.toLowerCase());
  if (tokens.includes('sponsored') && tokens.includes('noopener')) return anchorOpenTag;
  const next = [...new Set([...tokens, 'sponsored', 'noopener'])].join(' ');
  return anchorOpenTag.replace(REL_ATTR_RE, ` rel=${relMatch[1]}${next}${relMatch[1]}`);
}

function trackedShopUrl(href: string, slug: string, sitewide: boolean): string | null {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return null;
  const program = programForSlugAndHost(slug, parsed.hostname.toLowerCase(), sitewide);
  return program ? wrapShopDestination(parsed.toString(), program) : null;
}

/**
 * Rewrite naked shop hrefs to Adtraction tracking links and mark every
 * tracked shop anchor `rel="sponsored noopener"`.
 * Already-tracked `do.p-lindberg.se` / `id.vetapotek.se` / `go.wexthuset.com` /
 * `do.shop.firstvet.com` / `do.outl1.se` / `pin.bonden.se` links keep their href.
 */
export function rewriteNakedShopAffiliateHrefs(
  content: string,
  slug?: string,
  { sitewide = true }: ShopRewriteOptions = {},
): string {
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

  out = out.replace(MARKDOWN_LINK_RE, (full, url: string) => {
    const tracked = trackedShopUrl(url, slug, sitewide);
    return tracked ? `](${tracked})` : full;
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

export function isNakedWexthusetShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.wexthuset.com' || host === 'wexthuset.com';
}

export function isNakedFirstVetShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.firstvet.com' || host === 'firstvet.com';
}

export function isNakedOutl1ShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.outl1.se' || host === 'outl1.se';
}

export function isNakedBondenShopHref(href: string): boolean {
  const parsed = parseAbsoluteUrl(href);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'www.bonden.se' || host === 'bonden.se';
}
