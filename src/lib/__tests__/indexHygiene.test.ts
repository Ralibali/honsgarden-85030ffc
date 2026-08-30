import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  matchRoute,
  STATIC_PUBLIC_ROUTES,
  ROUTE_REDIRECTS,
} from '../routeInventory';
import {
  TAG_MIN_POSTS,
  countPostsPerTag,
  indexableTags,
  normalizeOrtKey,
  ortHasSupply,
} from '../sitemapPolicy';
import { longformPages } from '@/data/honsraserContent';
import { ORTER } from '@/data/saljaAggOrter';

const readRepoFile = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

describe('canonical-konsolidering av äldre rassidor', () => {
  it('pekar /dvarghons och /skansk-blommehona 308 mot /honsraser/<slug>', () => {
    expect(matchRoute('/dvarghons')).toEqual({
      kind: 'redirect',
      destination: '/honsraser/dvarghons',
      statusCode: 308,
    });
    expect(matchRoute('/skansk-blommehona')).toEqual({
      kind: 'redirect',
      destination: '/honsraser/skansk-blommehona',
      statusCode: 308,
    });
  });

  it('listar inte de gamla sökvägarna som statiska rutter', () => {
    expect(STATIC_PUBLIC_ROUTES).not.toContain('/dvarghons');
    expect(STATIC_PUBLIC_ROUTES).not.toContain('/skansk-blommehona');
  });

  it('har canonical-sidorna sitt egen path (ingen canonical-loop)', () => {
    expect(longformPages['dvarghons'].path).toBe('/honsraser/dvarghons');
    expect(longformPages['skansk-blommehona'].path).toBe('/honsraser/skansk-blommehona');
    // Canonical-målen måste fortsatt träffa den dynamiska ras-routen.
    expect(matchRoute('/honsraser/dvarghons').kind).toBe('dynamic');
    expect(matchRoute('/honsraser/skansk-blommehona').kind).toBe('dynamic');
  });

  it('har inga dubbletter bland longform-sidornas canonical paths', () => {
    const paths = Object.values(longformPages).map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('saknar SPA-rutter för de gamla sökvägarna (edge 308:ar dem)', () => {
    const app = readRepoFile('src/App.tsx');
    expect(app).not.toMatch(/path="\/dvarghons"/);
    expect(app).not.toMatch(/path="\/skansk-blommehona"/);
  });

  it('pekar alla relaterade länkar på sidor som faktiskt finns', () => {
    // longformPages slår samman statiska landningar + alla 25 rasprofiler.
    for (const [slug, page] of Object.entries(longformPages)) {
      for (const link of page.relatedLinks) {
        const match = link.href.match(/^\/honsraser\/(.+)$/);
        if (!match) continue; // länkar utanför ras-sektionen täcks av routeInventory
        expect(
          Boolean(longformPages[match[1]]),
          `${slug} länkar till ${link.href} som saknar sida`,
        ).toBe(true);
      }
    }
  });

  it('omdirigeringar finns också i vercel.json', () => {
    const vercel = JSON.parse(readRepoFile('vercel.json'));
    const redirects = (vercel.redirects ?? []).map((r: { source: string }) => r.source);
    for (const { source } of ROUTE_REDIRECTS) expect(redirects).toContain(source);
  });
});

describe('taggsidors indextröskel', () => {
  const posts = [
    { tags: ['hälsa', 'vinter'] },
    { tags: ['hälsa', 'foder'] },
    { tags: ['vinter'] },
    { tags: [] },
    { category: 'guide' }, // kategori får aldrig räknas som tagg
  ];

  it('räknar bara riktiga taggar, aldrig kategorier', () => {
    const counts = countPostsPerTag(posts);
    expect(counts.get('hälsa')).toBe(2);
    expect(counts.get('vinter')).toBe(2);
    expect(counts.get('foder')).toBe(1);
    expect(counts.has('guide')).toBe(false);
  });

  it('listar bara taggar med minst TAG_MIN_POSTS artiklar', () => {
    expect(TAG_MIN_POSTS).toBe(2);
    expect(indexableTags(posts)).toEqual(['hälsa', 'vinter']);
  });

  it('returnerar tomt för tom artikelmängd', () => {
    expect(indexableTags([])).toEqual([]);
  });
});

describe('ort-likviditetsgrinden', () => {
  it('normaliserar svenska ortnamn till slugform', () => {
    expect(normalizeOrtKey('Göteborg')).toBe('goteborg');
    expect(normalizeOrtKey('Örnsköldsvik')).toBe('ornskoldsvik');
    expect(normalizeOrtKey('Österåker kommun')).toBe('osteraker-kommun');
    expect(normalizeOrtKey('  Västerås! ')).toBe('vasteras');
  });

  it('matchar aktivt utbud mot ort-slug på ordgräns', () => {
    const locations = ['Göteborg', 'Mora by, Falu kommun'];
    expect(ortHasSupply('goteborg', locations)).toBe(true);
    expect(ortHasSupply('mora', locations)).toBe(true);
    expect(ortHasSupply('falun', locations)).toBe(false); // "Falu kommun" ≠ Falun
    expect(ortHasSupply('lund', ['Lundby'])).toBe(false);
    expect(ortHasSupply('lund', ['Lund'])).toBe(true);
    expect(ortHasSupply('umea', [])).toBe(false);
  });

  it('har unika ort-slug att matcha mot', () => {
    const slugs = ORTER.map((ort) => ort.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // Alla slug måste kunna normaliseras fram ur sitt eget namn —
    // annars kan likviditetsgrinden aldrig matcha orten mot en plats.
    for (const ort of ORTER) {
      expect(
        ortHasSupply(ort.slug, [ort.name]),
        `${ort.name} (${ort.slug}) matchar inte sin egen plats`,
      ).toBe(true);
    }
  });
});

describe('byggtidens prerender följer samma policy', () => {
  const script = readRepoFile('scripts/prerender-blog-posts.mjs');

  it('prerenderar bara indexerbara taggar (≥2 artiklar)', () => {
    expect(script).toContain('indexableTags(posts)');
  });

  it('prerenderar canonical-URL:erna för de gamla rassidorna', () => {
    expect(script).toContain("path: '/honsraser/dvarghons'");
    expect(script).toContain("path: '/honsraser/skansk-blommehona'");
    expect(script).not.toContain("path: '/dvarghons'");
    expect(script).not.toContain("path: '/skansk-blommehona'");
  });

  it('hämtar aktivt äggutbud för likviditetsgrinden', () => {
    expect(script).toContain('public_egg_sale_listings');
    expect(script).toContain('ortHasSupply');
  });
});

describe('den dynamiska sitemap-edgefunktionen följer samma policy', () => {
  const fn = readRepoFile('supabase/functions/sitemap/index.ts');

  it('listar inte längre de gaml a sökvägarna som statiska sidor', () => {
    expect(fn).not.toContain('{ loc: "/dvarghons"');
    expect(fn).not.toContain('{ loc: "/skansk-blommehona"');
  });

  it('listar canonical-URL:erna under /honsraser/', () => {
    expect(fn).toContain('"dvarghons"');
    expect(fn).toContain('"skansk-blommehona"');
  });

  it('räknar taggar med tröskel och lägger inte kategorier som taggar', () => {
    expect(fn).toContain('TAG_MIN_POSTS');
    expect(fn).not.toContain('allTags.add(post.category)');
  });

  it('likviditetsgrinar ort-sidorna', () => {
    expect(fn).toContain('ortHasSupply');
    expect(fn).toContain('if (!ortHasSupply(ort)) continue;');
  });
});
