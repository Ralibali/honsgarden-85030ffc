/**
 * Cap 1 Packet 1 shop placements on zero-commerce public URLs.
 *
 * Uses existing Adtraction host/a= wraps (Outl1, P-Lindberg, Bonden).
 * Destinations are merchant landings or product URLs already used in-repo.
 * Keep in sync with `src/lib/contextualShopPlacements.mjs`.
 */

import {
  buildTrackedShopHref,
  type PacketShopMerchant,
} from './adtractionShopLinks';

export type ShopPlacementLink = {
  merchant: PacketShopMerchant;
  destination: string;
  label: string;
};

export type ShopPlacement = {
  path: string;
  slug?: string;
  body: string;
  links: readonly ShopPlacementLink[];
};

/** Live destinations already used by köpguide / affiliateProducts / existing wraps. */
export const SHOP_DESTINATIONS = {
  outl1Honshus: 'https://outl1.se/honshus-med-utegard?var=12423',
  plindbergHome: 'https://www.p-lindberg.se/',
  plindbergStartset: 'https://www.p-lindberg.se/startset-hoens-bas-9067617/',
  plindbergRede: 'https://www.p-lindberg.se/vaerprede-poppis-9063893/',
  plindbergFodertraag: 'https://www.p-lindberg.se/fodertraag-till-hoens-9035331-main/',
  bondenHome: 'https://www.bonden.se/',
} as const;

export const CONTEXTUAL_SHOP_PLACEMENTS: readonly ShopPlacement[] = [
  {
    path: '/',
    body: 'Hönshus och startutrustning till nya flockar — samma butiker som i våra köpguider.',
    links: [
      { merchant: 'outl1', destination: SHOP_DESTINATIONS.outl1Honshus, label: 'Se hönshus hos Outl1' },
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergStartset, label: 'Se startset hos P-Lindberg' },
    ],
  },
  {
    path: '/honsraser',
    slug: 'honsraser',
    body: 'När rasen är vald behövs hus, reden och foderutrustning.',
    links: [
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergHome, label: 'Jämför hönsutrustning hos P-Lindberg' },
    ],
  },
  {
    path: '/honsraser/brahma',
    slug: 'brahma',
    body: 'Brahma är stora höns — reden och inredning behöver extra utrymme.',
    links: [
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergRede, label: 'Se värpreden hos P-Lindberg' },
    ],
  },
  {
    path: '/honsraser/orpington',
    slug: 'orpington',
    body: 'Foder och gårdsutrustning till en lugn hobbyflock.',
    links: [
      { merchant: 'bonden', destination: SHOP_DESTINATIONS.bondenHome, label: 'Se foderutrustning hos Bonden' },
    ],
  },
  {
    path: '/borja-med-hons',
    slug: 'borja-med-hons',
    body: 'Hus och startutrustning innan första hönorna flyttar in.',
    links: [
      { merchant: 'outl1', destination: SHOP_DESTINATIONS.outl1Honshus, label: 'Se hönshus hos Outl1' },
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergStartset, label: 'Se startset hos P-Lindberg' },
    ],
  },
  {
    path: '/blogg/bast-honsras-sverige',
    slug: 'bast-honsras-sverige',
    body: 'När rasen är vald behövs reden, foder och hus.',
    links: [
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergHome, label: 'Jämför hönsutrustning hos P-Lindberg' },
    ],
  },
  {
    path: '/blogg/foder-till-hons-guide',
    slug: 'foder-till-hons-guide',
    body: 'Foder och fodertråg från butiker vi redan länkar till i andra guider.',
    links: [
      { merchant: 'bonden', destination: SHOP_DESTINATIONS.bondenHome, label: 'Se foderutrustning hos Bonden' },
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergFodertraag, label: 'Se fodertråg hos P-Lindberg' },
    ],
  },
  {
    path: '/blogg/skaffa-hons-nyborjarguide',
    slug: 'skaffa-hons-nyborjarguide',
    body: 'Hus och startutrustning innan första hönorna flyttar in.',
    links: [
      { merchant: 'outl1', destination: SHOP_DESTINATIONS.outl1Honshus, label: 'Se hönshus hos Outl1' },
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergStartset, label: 'Se startset hos P-Lindberg' },
    ],
  },
  {
    path: '/blogg/hobbyhons-nyborjarguide',
    slug: 'hobbyhons-nyborjarguide',
    body: 'Hus och startutrustning till en liten hobbyflock.',
    links: [
      { merchant: 'outl1', destination: SHOP_DESTINATIONS.outl1Honshus, label: 'Se hönshus hos Outl1' },
      { merchant: 'p-lindberg', destination: SHOP_DESTINATIONS.plindbergStartset, label: 'Se startset hos P-Lindberg' },
    ],
  },
];

export function shopPlacementForPath(path?: string | null): ShopPlacement | undefined {
  if (!path) return undefined;
  return CONTEXTUAL_SHOP_PLACEMENTS.find((placement) => placement.path === path);
}

export function shopPlacementForSlug(slug?: string | null): ShopPlacement | undefined {
  if (!slug) return undefined;
  return CONTEXTUAL_SHOP_PLACEMENTS.find((placement) => placement.slug === slug);
}

function escapeHtml(value = ''): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function trackedShopHref(link: ShopPlacementLink): string {
  return buildTrackedShopHref(link.merchant, link.destination);
}

export function renderContextualShopPlacementHtml(placement: ShopPlacement): string {
  const links = placement.links
    .map((link) => {
      const href = escapeHtml(trackedShopHref(link));
      return `<a href="${href}" target="_blank" rel="sponsored noopener noreferrer">${escapeHtml(link.label)}</a>`;
    })
    .join(' <span aria-hidden="true">·</span> ');

  return (
    `<aside class="my-8 rounded-2xl border border-border/40 bg-gradient-to-br from-card to-secondary/40 p-5 sm:p-6" data-shop-placement="${escapeHtml(placement.path)}" aria-label="Annons">`
    + `<p class="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Annons</p>`
    + `<p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(placement.body)}</p>`
    + `<p class="mt-3 text-sm font-medium text-foreground">${links}</p>`
    + `</aside>`
  );
}

export function htmlHasContextualShopPlacement(html: string, placement: ShopPlacement): boolean {
  return html.includes(`data-shop-placement="${placement.path}"`) || html.includes(placement.body);
}

/** Inject blog-slug shop placement. Idempotent. Non-blog slugs unchanged. */
export function injectContextualShopPlacement(html = '', slug?: string | null): string {
  const placement = shopPlacementForSlug(slug);
  if (!html || !placement || !placement.path.startsWith('/blogg/')) return html;
  if (htmlHasContextualShopPlacement(html, placement)) return html;
  return `${html}${renderContextualShopPlacementHtml(placement)}`;
}
