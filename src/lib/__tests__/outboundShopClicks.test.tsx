import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MouseEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AFFILIATE_ENABLED } from '@/lib/featureFlags';
import { rewriteNakedShopAffiliateHrefs } from '@/lib/adtractionShopLinks';
import {
  HQ_OUTBOUND_BLOG_PAGES,
  outboundPageFromSlug,
  outboundProgramFromHref,
  trackOutboundShopClickFromEvent,
} from '@/lib/outboundShopClicks';

const PAGE_FIXTURES: Record<keyof typeof HQ_OUTBOUND_BLOG_PAGES, string> = {
  'bygga-honshus':
    'stor vardagsvinst. <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Jämför hönsluckor hos P-Lindberg</a> och <a href="https://www.granngarden.se/">Granngården</a> <a href="https://www.bonden.se/">Bonden</a>',
  'kopa-hons':
    '<a href="https://www.granngarden.se/">Granngården</a> <a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Se foderautomater hos P-Lindberg</a> <a href="https://www.bonden.se/">Bonden</a>',
  'brahma-hons':
    '<a href="https://www.p-lindberg.se/" target="_blank" rel="nofollow sponsored">Se värpreden hos P-Lindberg</a> <a href="https://www.granngarden.se/" target="_blank" rel="nofollow sponsored">Jämför vattenautomater hos Granngården</a> <a href="https://www.bonden.se/" target="_blank" rel="nofollow sponsored">Se foderutrustning hos Bonden</a>',
  'vad-ater-hons':
    '<a href="https://www.bonden.se/" target="_blank">Bonden.se</a>, <a href="https://www.p-lindberg.se/" target="_blank">P-Lindberg.se</a></li><li><strong>Vitamintillskott</strong> – <a href="https://vetapotek.se/" target="_blank">Vetapotek.se</a>, <a href="https://www.vetzoo.se/">Vetzoo</a> <a href="https://www.wexthuset.com/">Wexthuset</a> <a href="https://firstvet.com/sv/butik">FirstVet</a>',
};

function mockPlausible() {
  const calls: Array<{ event: string; props?: Record<string, unknown> }> = [];
  window.plausible = ((event: string, options?: { props?: Record<string, unknown> }) => {
    calls.push({ event, props: options?.props });
  }) as typeof window.plausible;
  return calls;
}

function renderHqPage(slug: keyof typeof HQ_OUTBOUND_BLOG_PAGES) {
  const html = rewriteNakedShopAffiliateHrefs(PAGE_FIXTURES[slug], slug);
  const handle = (e: MouseEvent<HTMLDivElement>) => trackOutboundShopClickFromEvent(e, slug);
  render(
    <div
      data-testid={`hq-page-${slug}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onMouseDownCapture={handle}
      onAuxClickCapture={handle}
      onContextMenuCapture={handle}
    />,
  );
  return html;
}

function outboundCalls(calls: Array<{ event: string; props?: Record<string, unknown> }>) {
  return calls.filter((call) => call.event === 'Outbound Clicked');
}

beforeEach(() => {
  mockPlausible();
});

afterEach(() => {
  delete window.plausible;
});

describe('HQ outbound shop click mapping', () => {
  it('maps only the four HQ pathnames, never free text', () => {
    expect(outboundPageFromSlug('kopa-hons')).toBe('/blogg/kopa-hons');
    expect(outboundPageFromSlug('brahma-hons')).toBe('/blogg/brahma-hons');
    expect(outboundPageFromSlug('bygga-honshus')).toBe('/blogg/bygga-honshus');
    expect(outboundPageFromSlug('vad-ater-hons')).toBe('/blogg/vad-ater-hons');
    expect(outboundPageFromSlug('fjaderplockning-hons')).toBeNull();
    expect(outboundPageFromSlug('honshus-2026-kompletta-kopguiden')).toBeNull();
  });

  it('maps naked Granngården / VetZoo and existing Adtraction hosts, not FirstVet', () => {
    expect(outboundProgramFromHref('https://www.granngarden.se/')).toBe('granngarden');
    expect(outboundProgramFromHref('https://www.vetzoo.se/')).toBe('vetzoo');
    expect(
      outboundProgramFromHref(
        'https://pin.bonden.se/t/t?a=1960530621&as=2056181186&t=2&tk=1&url=https://www.bonden.se/',
      ),
    ).toBe('bonden');
    expect(
      outboundProgramFromHref(
        'https://do.p-lindberg.se/t/t?a=1954027467&as=2056181186&t=2&tk=1&url=https%3A%2F%2Fwww.p-lindberg.se%2F',
      ),
    ).toBe('p-lindberg');
    expect(
      outboundProgramFromHref(
        'https://go.wexthuset.com/t/t?a=1577762835&as=2056181186&t=2&tk=1&url=https%3A%2F%2Fwww.wexthuset.com%2F',
      ),
    ).toBe('wexthuset');
    expect(
      outboundProgramFromHref(
        'https://id.vetapotek.se/t/t?a=1701463575&as=2056181186&t=2&tk=1&url=https://vetapotek.se/',
      ),
    ).toBe('vetapotek');
    expect(outboundProgramFromHref('https://firstvet.com/sv/butik')).toBeNull();
    expect(outboundProgramFromHref('https://id.granngarden.se/')).toBeNull();
  });

  it('does not flip AFFILIATE_ENABLED', () => {
    expect(AFFILIATE_ENABLED).toBe(false);
  });
});

describe('Outbound Clicked on the four HQ blog pages', () => {
  it.each([
    ['kopa-hons', 'Granngården', 'granngarden', 'https://www.granngarden.se/'],
    ['brahma-hons', 'Jämför vattenautomater hos Granngården', 'granngarden', 'https://www.granngarden.se/'],
    ['bygga-honshus', 'Granngården', 'granngarden', 'https://www.granngarden.se/'],
    ['vad-ater-hons', 'Vetzoo', 'vetzoo', 'https://www.vetzoo.se/'],
  ] as const)(
    'fires program+page when clicking the live naked shop link on /blogg/%s',
    (slug, name, program, href) => {
      const calls = mockPlausible();
      const html = renderHqPage(slug);
      expect(html).toContain(`href="${href}"`);

      fireEvent.mouseDown(screen.getByRole('link', { name }));

      expect(outboundCalls(calls)).toEqual([
        { event: 'Outbound Clicked', props: { program, page: `/blogg/${slug}` } },
      ]);
    },
  );

  it.each([
    ['kopa-hons', 'Se foderautomater hos P-Lindberg', 'p-lindberg'],
    ['kopa-hons', 'Bonden', 'bonden'],
    ['brahma-hons', 'Se värpreden hos P-Lindberg', 'p-lindberg'],
    ['brahma-hons', 'Se foderutrustning hos Bonden', 'bonden'],
    ['bygga-honshus', 'Jämför hönsluckor hos P-Lindberg', 'p-lindberg'],
    ['bygga-honshus', 'Bonden', 'bonden'],
    ['vad-ater-hons', 'Bonden.se', 'bonden'],
    ['vad-ater-hons', 'P-Lindberg.se', 'p-lindberg'],
    ['vad-ater-hons', 'Vetapotek.se', 'vetapotek'],
    ['vad-ater-hons', 'Wexthuset', 'wexthuset'],
  ] as const)(
    'fires program+page when clicking the existing Adtraction link %s / %s',
    (slug, name, program) => {
      const calls = mockPlausible();
      const html = renderHqPage(slug);
      expect(html).toMatch(/\/t\/t\?a=/);

      fireEvent.mouseDown(screen.getByRole('link', { name }));

      expect(outboundCalls(calls)).toEqual([
        { event: 'Outbound Clicked', props: { program, page: `/blogg/${slug}` } },
      ]);
    },
  );

  it('does not fire for FirstVet on vad-ater-hons (not in program enum)', () => {
    const calls = mockPlausible();
    renderHqPage('vad-ater-hons');
    fireEvent.mouseDown(screen.getByRole('link', { name: 'FirstVet' }));
    expect(outboundCalls(calls)).toEqual([]);
  });

  it('does not fire Granngården clicks on slugs outside the four HQ pages', () => {
    const calls = mockPlausible();
    const html = rewriteNakedShopAffiliateHrefs(
      '<a href="https://www.granngarden.se/">Granngården</a>',
      'fjaderplockning-hons',
    );
    const handle = (e: MouseEvent<HTMLDivElement>) =>
      trackOutboundShopClickFromEvent(e, 'fjaderplockning-hons');
    render(
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        onMouseDownCapture={handle}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('link', { name: 'Granngården' }));
    expect(outboundCalls(calls)).toEqual([]);
  });

  it('does not double-wrap already-tracked hosts when the click HTML is rewritten', () => {
    const html = renderHqPage('bygga-honshus');
    expect(html).toContain('do.p-lindberg.se/t/t?a=1954027467');
    expect(html).toContain('pin.bonden.se/t/t?a=1960530621');
    expect(html).not.toContain('do.p-lindberg.se/t/t?a=1954027467&amp;as=2056181186&amp;t=2&amp;tk=1&amp;url=https://do.p-lindberg.se');
    expect(html).toContain('href="https://www.granngarden.se/"');
  });
});

describe('GuideArticle wires Outbound Clicked without mounting the strip', () => {
  const article = readFileSync(join(process.cwd(), 'src/pages/GuideArticle.tsx'), 'utf8');
  const flags = readFileSync(join(process.cwd(), 'src/lib/featureFlags.ts'), 'utf8');

  it('calls trackOutboundShopClick from the prose click handler', () => {
    expect(article).toContain("import { trackOutboundShopClick } from '@/lib/outboundShopClicks'");
    expect(article).toContain('trackOutboundShopClick(href, slug)');
  });

  it('does not mount AffiliateProductStrip and leaves AFFILIATE_ENABLED false', () => {
    expect(article).not.toContain('AffiliateProductStrip');
    expect(flags).toMatch(/export const AFFILIATE_ENABLED = false/);
  });
});
