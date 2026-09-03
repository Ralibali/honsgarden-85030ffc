/**
 * Plausible `Outbound Clicked` for the four HQ public blog slugs.
 *
 * Granngården + VetZoo stay naked (no real Adtraction `a=` / tracking host
 * after repo + PR 25/26/34 lookup). Existing Adtraction hosts on those pages
 * are also counted. Does not wrap hrefs and does not invent program IDs.
 */

import {
  trackEvent,
  type AnalyticsOutboundPage,
  type AnalyticsOutboundProgram,
} from '@/lib/analytics';

export const HQ_OUTBOUND_BLOG_PAGES = {
  'kopa-hons': '/blogg/kopa-hons',
  'brahma-hons': '/blogg/brahma-hons',
  'bygga-honshus': '/blogg/bygga-honshus',
  'vad-ater-hons': '/blogg/vad-ater-hons',
} as const satisfies Record<string, AnalyticsOutboundPage>;

export type HqOutboundBlogSlug = keyof typeof HQ_OUTBOUND_BLOG_PAGES;

const PROGRAM_HOSTS: Record<AnalyticsOutboundProgram, readonly string[]> = {
  granngarden: ['www.granngarden.se', 'granngarden.se'],
  vetzoo: ['www.vetzoo.se', 'vetzoo.se'],
  bonden: ['www.bonden.se', 'bonden.se', 'pin.bonden.se'],
  'p-lindberg': ['www.p-lindberg.se', 'p-lindberg.se', 'do.p-lindberg.se'],
  wexthuset: ['www.wexthuset.com', 'wexthuset.com', 'go.wexthuset.com'],
  vetapotek: ['www.vetapotek.se', 'vetapotek.se', 'id.vetapotek.se'],
};

function hostnameOf(href: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, '&').trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function outboundPageFromSlug(slug: string | undefined): AnalyticsOutboundPage | null {
  if (!slug) return null;
  return HQ_OUTBOUND_BLOG_PAGES[slug as HqOutboundBlogSlug] ?? null;
}

export function outboundProgramFromHref(href: string): AnalyticsOutboundProgram | null {
  const hostname = hostnameOf(href);
  if (!hostname) return null;
  for (const [program, hosts] of Object.entries(PROGRAM_HOSTS) as Array<
    [AnalyticsOutboundProgram, readonly string[]]
  >) {
    if (hosts.includes(hostname)) return program;
  }
  return null;
}

export function trackOutboundShopClick(href: string, slug: string | undefined): void {
  const page = outboundPageFromSlug(slug);
  if (!page) return;
  const program = outboundProgramFromHref(href);
  if (!program) return;
  trackEvent('Outbound Clicked', { program, page });
}

/** Same capture timing as existing blog prose affiliate clicks (mousedown / aux / contextmenu). */
export function trackOutboundShopClickFromEvent(
  e: { type: string; detail?: number; target: EventTarget | null },
  slug: string | undefined,
): void {
  if (e.type === 'click' && (e.detail ?? 0) > 0) return;
  const target = e.target as HTMLElement | null;
  const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
  if (!anchor?.href) return;
  trackOutboundShopClick(anchor.href, slug);
}
